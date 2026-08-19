-- =====================================================================
-- 검증 08 — 기록만 하고 판정하지 않는다
--
-- 기관 확인 결과 확정된 설계:
--   "이의신청, 기산점, 심의 주체 구성은 심사처에서 전달받은 내용을 기반으로 하므로
--    기록 외 별도 로직이 필요하지 않습니다. 서식 및 신청서 원본 등은 별도로
--    저장되어 있으면 됩니다."
--
-- 확인 항목
--   R1. 차수에 기한 일수가 없으면 이의신청 기한을 지어내지 않는다 (예전엔 14일을 만들었음)
--   R2. 차수에 심사처가 알려준 일수가 있으면 통지일에 더해 채운다
--   R3. 직접 적어 준 기한은 트리거가 덮어쓰지 않는다
--   R4. 심의 주체는 구성을 자유 서술로 기록만 하고 정족수 등을 검사하지 않는다
--   R5. 신청서 원본은 참여자별 경로로 보관되고 소유자 판별이 동작한다
--   R6. 원본 서류에 대해 당사자 본인은 읽을 수 있고 남은 볼 수 없다 (RLS)
--
-- ID 는 다른 검증 파일과 겹치지 않게 b0-접두 UUID 를 쓴다.
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00~05 → 이 파일
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 ────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001','rec-a@test.local'),
  ('b0000000-0000-0000-0000-000000000002','rec-b@test.local'),
  ('b0000000-0000-0000-0000-00000000000f','rec-staff@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('b0000000-0000-0000-0000-000000000001','participant','기록참여자A'),
  ('b0000000-0000-0000-0000-000000000002','participant','기록참여자B'),
  ('b0000000-0000-0000-0000-00000000000f','supporter','기록실무자')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('b1111111-1111-1111-1111-111111111111','기록참여자A','b0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-00000000000f'),
  ('b1111111-2222-2222-2222-222222222222','기록참여자B','b0000000-0000-0000-0000-000000000002',
     'b0000000-0000-0000-0000-00000000000f')
ON CONFLICT (id) DO NOTHING;

-- 차수 두 개: 기한 일수를 모르는 것(NULL)과 심사처가 알려준 것(21일)
INSERT INTO public.seoul_cohorts
  (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed,
   copay_rate, copay_max, appeal_due_days, starts_on, ends_on)
VALUES
  ('b2222222-0000-0000-0000-00000000000a','test_rec_unknown','기한 미전달 차수',6,400000,2400000,TRUE,
   0,NULL,NULL,'2026-01-01','2026-12-31'),
  ('b2222222-0000-0000-0000-00000000000b','test_rec_known','기한 21일 전달 차수',6,400000,2400000,TRUE,
   0,NULL,21,'2026-01-01','2026-12-31')
ON CONFLICT (code) DO NOTHING;

-- 신청 → 계획 → 심의 → 통지 (이의신청의 선행조건)
INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number) VALUES
  ('b3000000-0000-0000-0000-00000000000a','b1111111-1111-1111-1111-111111111111','b2222222-0000-0000-0000-00000000000a','RC-A'),
  ('b3000000-0000-0000-0000-00000000000b','b1111111-2222-2222-2222-222222222222','b2222222-0000-0000-0000-00000000000b','RC-B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status) VALUES
  ('b4000000-0000-0000-0000-00000000000a','b1111111-1111-1111-1111-111111111111','b3000000-0000-0000-0000-00000000000a','b2222222-0000-0000-0000-00000000000a','rejected'),
  ('b4000000-0000-0000-0000-00000000000b','b1111111-2222-2222-2222-222222222222','b3000000-0000-0000-0000-00000000000b','b2222222-0000-0000-0000-00000000000b','rejected')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_plan_reviews (id, plan_id, decision, reason) VALUES
  ('b5000000-0000-0000-0000-00000000000a','b4000000-0000-0000-0000-00000000000a','rejected','검증용 사유'),
  ('b5000000-0000-0000-0000-00000000000b','b4000000-0000-0000-0000-00000000000b','rejected','검증용 사유')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_notifications (id, review_id, participant_id, notified_on, method) VALUES
  ('b6000000-0000-0000-0000-00000000000a','b5000000-0000-0000-0000-00000000000a','b1111111-1111-1111-1111-111111111111','2026-03-02','app'),
  ('b6000000-0000-0000-0000-00000000000b','b5000000-0000-0000-0000-00000000000b','b1111111-2222-2222-2222-222222222222','2026-03-02','app')
ON CONFLICT (id) DO NOTHING;


\echo ''
\echo '=== R1. 기한 일수를 모르는 차수 → due_on 을 지어내지 않아야 함 ==='
INSERT INTO public.seoul_appeals (id, notification_id, participant_id, ground)
VALUES ('b7000000-0000-0000-0000-00000000000a','b6000000-0000-0000-0000-00000000000a',
        'b1111111-1111-1111-1111-111111111111','서비스가 왜 안 되는지 모르겠어요');

SELECT '   due_on = ' || COALESCE(due_on::text,'(비어 있음)') || '  '
       || CASE WHEN due_on IS NULL THEN '✅ (지어내지 않음)' ELSE '❌ (없는 근거로 기한 생성)' END
  FROM public.seoul_appeals WHERE id = 'b7000000-0000-0000-0000-00000000000a';


\echo ''
\echo '=== R2. 심사처가 21일이라 알려준 차수 → 통지일 + 21일 ==='
INSERT INTO public.seoul_appeals (id, notification_id, participant_id, ground)
VALUES ('b7000000-0000-0000-0000-00000000000b','b6000000-0000-0000-0000-00000000000b',
        'b1111111-2222-2222-2222-222222222222','다시 봐주세요');

SELECT '   통지 2026-03-02 + 21일 → ' || due_on || '  '
       || CASE WHEN due_on = DATE '2026-03-23' THEN '✅' ELSE '❌' END
  FROM public.seoul_appeals WHERE id = 'b7000000-0000-0000-0000-00000000000b';


\echo ''
\echo '=== R3. 직접 적어 준 기한은 트리거가 덮어쓰지 않아야 함 ==='
UPDATE public.seoul_appeals SET due_on = DATE '2026-04-30'
 WHERE id = 'b7000000-0000-0000-0000-00000000000a';

SELECT '   직접 기록한 기한 → ' || due_on || '  '
       || CASE WHEN due_on = DATE '2026-04-30' THEN '✅ (기록 그대로)' ELSE '❌' END
  FROM public.seoul_appeals WHERE id = 'b7000000-0000-0000-0000-00000000000a';


\echo ''
\echo '=== R4. 심의 주체 — 구성을 자유 서술로 기록만 한다 ==='
INSERT INTO public.seoul_review_committees (id, name, composition_note)
VALUES ('b8000000-0000-0000-0000-000000000001','2026년 3차 심의위원회',
        '심사처 전달: 외부위원 3명, 자치구 1명 (정족수 안내 없음)')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_plan_reviews (id, plan_id, committee_id, decision, reason)
VALUES ('b5000000-0000-0000-0000-00000000000c','b4000000-0000-0000-0000-00000000000a',
        'b8000000-0000-0000-0000-000000000001','approved',NULL)
ON CONFLICT (id) DO NOTHING;

SELECT '   위원 수·정족수 검사 없이 기록됨: ' || c.name || '  ✅'
  FROM public.seoul_plan_reviews r
  JOIN public.seoul_review_committees c ON c.id = r.committee_id
 WHERE r.id = 'b5000000-0000-0000-0000-00000000000c';


\echo ''
\echo '=== R5. 신청서 원본 — 참여자별 경로로 보관되고 소유자 판별이 동작해야 함 ==='
-- 06_storage.sql 은 Supabase 전용 storage.buckets 를 건드려 로컬에서 통째로는 못 돌린다.
-- 여기서 보는 것은 경로 규칙과 소유자 추출이 맞물리는지뿐이므로 그 함수만 세운다.
-- (verify_00_auth_stub.sql 이 storage.foldername() 을 흉내 내 준다.)
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

INSERT INTO public.seoul_application_documents
  (id, application_id, participant_id, doc_type, file_name, storage_path, uploaded_by)
VALUES ('b9000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-00000000000a',
        'b1111111-1111-1111-1111-111111111111','application_form','신청서.pdf',
        'b1111111-1111-1111-1111-111111111111/applications/b3000000-0000-0000-0000-00000000000a/orig.pdf',
        'b0000000-0000-0000-0000-00000000000f')
ON CONFLICT (id) DO NOTHING;

SELECT '   경로에서 뽑은 소유자 = ' ||
       CASE WHEN public.seoul_storage_owner(storage_path) = participant_id
            THEN '참여자 본인  ✅' ELSE '불일치  ❌' END
  FROM public.seoul_application_documents WHERE id = 'b9000000-0000-0000-0000-000000000001';


\echo ''
\echo '=== R6. 원본 서류 RLS — 본인은 보고 남은 못 봐야 함 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
SELECT '   본인(A)이 보는 자기 서류: ' || count(*) || '건  '
       || CASE WHEN count(*) = 1 THEN '✅' ELSE '❌' END
  FROM public.seoul_application_documents WHERE id = 'b9000000-0000-0000-0000-000000000001';

RESET ROLE;
SET ROLE alice;
SET request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
SELECT '   남(B)이 보는 A 의 서류: ' || count(*) || '건  '
       || CASE WHEN count(*) = 0 THEN '✅ 차단됨' ELSE '❌ 노출됨' END
  FROM public.seoul_application_documents WHERE id = 'b9000000-0000-0000-0000-000000000001';

\echo '── B 가 A 의 서류를 지우려는 시도 → 막혀야 함'
DELETE FROM public.seoul_application_documents WHERE id = 'b9000000-0000-0000-0000-000000000001';
RESET ROLE;
-- ★ 삭제 여부는 반드시 RLS 밖에서 센다. B 로 세면 원래 SELECT 도 막혀 0 이 나오므로
--   "지워졌다"와 "안 보인다"를 구별할 수 없다.
SELECT '   삭제 시도 후 남은 건수: ' || count(*) || '  '
       || CASE WHEN count(*) = 1 THEN '✅ 방어됨' ELSE '❌ 삭제됨' END
  FROM public.seoul_application_documents WHERE id = 'b9000000-0000-0000-0000-000000000001';
