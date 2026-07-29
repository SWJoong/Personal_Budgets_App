-- =====================================================================
-- 06. Storage — private 버킷 + 소유권 범위 정책
--
-- 기존 앱의 결함 두 가지를 고친다 (탐색으로 확인):
--   1. 기존 마이그레이션(19_storage_buckets.sql)은 버킷을 public=true 로 만든다.
--      CLAUDE.md·코드(signed URL 생성 로직)는 private 을 전제하는데 실제로는
--      공개 — 발달장애인 영수증·활동사진이 URL 만 알면 누구나 열람 가능했다.
--   2. 기존 정책은 bucket_id 만 검사한다 (`USING (bucket_id = 'receipts')`).
--      로그인만 하면 인증된 아무나 남의 영수증을 지울 수 있었다.
--
-- 경로 규칙(이 리빌딩부터 3개 버킷 전부 동일하게 적용):
--   <participants.id>/<파일명>
-- 첫 폴더가 참여자 id 다. 업로드 코드는 항상 이 규칙을 지켜야 한다
-- (src/app/actions/document.ts 의 기존 패턴과 동일 — 그대로 재사용).
-- =====================================================================

-- 경로 첫 세그먼트에서 참여자 id 를 꺼낸다. 캐스팅 실패는 예외가 아니라 NULL —
-- 정책 안에서 예외가 나면 거부가 아니라 500 에러가 된다.
CREATE OR REPLACE FUNCTION public.seoul_storage_owner(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN ((storage.foldername(p_name))[1])::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ── 버킷: 전부 private. public 도 갱신 대상에 넣는다 —
--    기존 마이그레이션은 이 컬럼을 빼먹어서 재실행해도 절대 안 고쳐졌다.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('receipts',        'receipts',        false, 10485760,
     ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']),
  ('activity-photos', 'activity-photos', false, 10485760,
     ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('documents',       'documents',       false, 20971520, NULL)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 옛 정책 제거 (기존 앱의 이름 그대로 — 같은 프로젝트를 재사용할 경우 대비)
DROP POLICY IF EXISTS "receipts_insert"        ON storage.objects;
DROP POLICY IF EXISTS "receipts_select"        ON storage.objects;
DROP POLICY IF EXISTS "receipts_delete"        ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert"       ON storage.objects;
DROP POLICY IF EXISTS "documents_select"       ON storage.objects;
DROP POLICY IF EXISTS "documents_delete"       ON storage.objects;

-- ── receipts / activity-photos: 본인(=참여자) 또는 담당자·관리자만 읽고 쓴다.
--    삭제는 담당자·관리자 또는 업로드한 본인(storage.objects.owner)만 —
--    기존 정책은 bucket_id 만 봤으므로 아무나 남의 영수증을 지울 수 있었다.
DO $$
DECLARE b TEXT;
BEGIN
  FOREACH b IN ARRAY ARRAY['receipts','activity-photos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'seoul_' || replace(b,'-','_') || '_read');
    EXECUTE format($f$
      CREATE POLICY %1$I ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id = %2$L AND public.seoul_can_access(public.seoul_storage_owner(name)));
    $f$, 'seoul_' || replace(b,'-','_') || '_read', b);

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'seoul_' || replace(b,'-','_') || '_insert');
    EXECUTE format($f$
      CREATE POLICY %1$I ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = %2$L AND public.seoul_can_access(public.seoul_storage_owner(name)));
    $f$, 'seoul_' || replace(b,'-','_') || '_insert', b);

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'seoul_' || replace(b,'-','_') || '_update');
    EXECUTE format($f$
      CREATE POLICY %1$I ON storage.objects FOR UPDATE TO authenticated
        USING      (bucket_id = %2$L AND public.seoul_can_access(public.seoul_storage_owner(name)))
        WITH CHECK (bucket_id = %2$L AND public.seoul_can_access(public.seoul_storage_owner(name)));
    $f$, 'seoul_' || replace(b,'-','_') || '_update', b);

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'seoul_' || replace(b,'-','_') || '_delete');
    EXECUTE format($f$
      CREATE POLICY %1$I ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = %2$L
               AND (public.seoul_is_staff_for(public.seoul_storage_owner(name))
                    OR owner = auth.uid()));
    $f$, 'seoul_' || replace(b,'-','_') || '_delete', b);
  END LOOP;
END $$;

-- ── documents: 읽기는 본인도 (심의·통지 서류를 못 보면 이의신청이 불가능하다),
--              쓰기·삭제는 담당자·관리자만.
DROP POLICY IF EXISTS seoul_documents_read ON storage.objects;
CREATE POLICY seoul_documents_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.seoul_can_access(public.seoul_storage_owner(name)));

DROP POLICY IF EXISTS seoul_documents_write ON storage.objects;
CREATE POLICY seoul_documents_write ON storage.objects FOR ALL TO authenticated
  USING      (bucket_id = 'documents' AND public.seoul_is_staff_for(public.seoul_storage_owner(name)))
  WITH CHECK (bucket_id = 'documents' AND public.seoul_is_staff_for(public.seoul_storage_owner(name)));

-- 참고: 오늘 기준 스토리지 업·다운로드는 전부 createAdminClient()(서비스 롤)를 경유하므로
-- 이 정책들은 앱을 통해서는 발동하지 않는다. anon key 는 공개되어 있어 누구나
-- storage.objects 를 직접 두드릴 수 있으므로, 이 정책은 그 뒤에 세우는 벽이다.
