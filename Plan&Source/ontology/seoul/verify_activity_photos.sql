-- =====================================================================
-- 검증 — 활동 사진 (seoul_activity_photos) 스키마 + RLS 계약
--
-- 설계출처: Plan&Source/goala_activity_photos_W.md (§5 스키마, §6 읽기)
-- 배경: activity-photos 버킷·정책은 06_storage.sql 에 이미 있고, 이 테이블만 없었다.
--       영수증(seoul_receipts)과 동일한 RLS 규칙을 미러한다 —
--       열람=본인·담당 staff / 쓰기=staff 항상, 본인은 정산 전(pending)까지.
--
-- 확인 항목
--   T0. 테이블·필수 컬럼 존재 (구현 전이면 RED — 이게 이 계약의 RED 게이트)
--   T1. FK usage_id → seoul_service_usages, ON DELETE CASCADE
--   S1. 본인은 자기 활동사진을 읽는다
--   S2. 본인은 자기(정산 전) 지출에 활동사진을 붙인다
--   S2b. ★경로 위조 차단: 본인이라도 남의 접두 경로는 트리거가 막는다(seoul_check_activity_photo_path)
--   S3. 남(다른 참여자)은 내 활동사진을 못 읽는다 (RLS)
--   S4. 남은 내 지출에 활동사진을 못 붙인다 (RLS)
--   S5. 담당 실무자는 내 활동사진을 읽고 붙인다
--
-- ID 접두: 'ac' (다른 verify_*.sql 과 겹치지 않게 — README 재현은 같은 DB 에서 순차 실행).
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00~08 (03/04 에 §5 반영됨) → 이 파일
-- CI: .github/workflows/db-verify.yml 의 verify=(...) 배열에 verify_activity_photos 등록 필요.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 ────────────────────────────────────────────────────────────
-- 참여자A: 로그인 id ≠ 내부 키(participants.id) — 우연 일치로 결함 가려지는 것 방지(verify_02 관습).
INSERT INTO auth.users (id, email) VALUES
  ('acaaaaaa-0000-0000-0000-0000000000a1','ap-a-login@test.local'),   -- 참여자A 로그인
  ('acbbbbbb-0000-0000-0000-0000000000b1','ap-b-login@test.local'),   -- 참여자B 로그인(남)
  ('ac000000-0000-0000-0000-0000000000ff','ap-staff@test.local')      -- 담당 실무자
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('acaaaaaa-0000-0000-0000-0000000000a1','participant','활동참여자A'),
  ('acbbbbbb-0000-0000-0000-0000000000b1','participant','활동참여자B'),
  ('ac000000-0000-0000-0000-0000000000ff','supporter','활동실무자')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('ac111111-1111-1111-1111-111111111111','활동참여자A',
     'acaaaaaa-0000-0000-0000-0000000000a1','ac000000-0000-0000-0000-0000000000ff'),
  ('ac222222-2222-2222-2222-222222222222','활동참여자B',
     'acbbbbbb-0000-0000-0000-0000000000b1','ac000000-0000-0000-0000-0000000000ff')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_cohorts
  (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES
  ('ac999999-0000-0000-0000-0000000000c1','test_activity_photos','활동사진 검증 차수',6,400000,2400000,FALSE,14,'2025-01-01','2025-06-30')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.seoul_benefit_status (participant_id, participates_in_mohw_pilot) VALUES
  ('ac111111-1111-1111-1111-111111111111', FALSE)
ON CONFLICT (participant_id) DO NOTHING;

INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number, status) VALUES
  ('aca10000-0000-0000-0000-0000000000a1','ac111111-1111-1111-1111-111111111111',
     'ac999999-0000-0000-0000-0000000000c1','AP-001','received')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status)
VALUES ('acb10000-0000-0000-0000-0000000000a1','ac111111-1111-1111-1111-111111111111',
        'aca10000-0000-0000-0000-0000000000a1','ac999999-0000-0000-0000-0000000000c1','submitted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_plan_reviews (id, plan_id, decision, reason)
VALUES ('acd10000-0000-0000-0000-0000000000a1','acb10000-0000-0000-0000-0000000000a1','approved',NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_budget_allocations
  (id, participant_id, plan_id, review_id, cohort_id, monthly_ceiling, total_ceiling, period_months,
   carry_over_allowed, allocated_amount, starts_on, ends_on)
VALUES ('ace10000-0000-0000-0000-0000000000a1','ac111111-1111-1111-1111-111111111111',
        'acb10000-0000-0000-0000-0000000000a1','acd10000-0000-0000-0000-0000000000a1',
        'ac999999-0000-0000-0000-0000000000c1',400000,2400000,6,FALSE,2400000,'2025-01-01','2025-06-30')
ON CONFLICT (id) DO NOTHING;

-- 참여자A 의 지출 1건(정산 전 pending 기본값). 소유자 권한으로 넣어 RLS 우회(픽스처).
INSERT INTO public.seoul_service_usages (id, participant_id, allocation_id, usage_date, amount, description)
VALUES ('acf10000-0000-0000-0000-0000000000a1','ac111111-1111-1111-1111-111111111111',
        'ace10000-0000-0000-0000-0000000000a1','2025-03-08',50000,'나들이 활동')
ON CONFLICT (id) DO NOTHING;

\echo '=== T0. 스키마 계약: seoul_activity_photos 테이블·컬럼 (구현 전이면 RED) ==='
SELECT '   T0a. 테이블 존재: ' ||
       CASE WHEN to_regclass('public.seoul_activity_photos') IS NOT NULL THEN '✅' ELSE '❌ 없음(구현 대기)' END;
SELECT '   T0b. 필수 컬럼(usage_id,storage_path,caption,taken_at,created_at,id) 전부 존재: ' ||
       CASE WHEN (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='seoul_activity_photos'
                    AND column_name IN ('id','usage_id','storage_path','caption','taken_at','created_at')) = 6
            THEN '✅' ELSE '❌ 누락' END;
SELECT '   T0c. usage_id NOT NULL: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='seoul_activity_photos' AND column_name='usage_id' AND is_nullable='NO')
            THEN '✅' ELSE '❌' END;
SELECT '   T0d. storage_path NOT NULL: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='seoul_activity_photos' AND column_name='storage_path' AND is_nullable='NO')
            THEN '✅' ELSE '❌' END;

-- 픽스처 사진 2장(소유자 권한, RLS 우회) — 열람/삭제 테스트용.
INSERT INTO public.seoul_activity_photos (id, usage_id, storage_path, caption) VALUES
  ('ac700000-0000-0000-0000-0000000000a1','acf10000-0000-0000-0000-0000000000a1',
     'ac111111-1111-1111-1111-111111111111/acf10000-0000-0000-0000-0000000000a1/1.jpg','나들이 사진1'),
  ('ac700000-0000-0000-0000-0000000000a2','acf10000-0000-0000-0000-0000000000a1',
     'ac111111-1111-1111-1111-111111111111/acf10000-0000-0000-0000-0000000000a1/2.jpg','나들이 사진2')
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '=== T1. FK ON DELETE CASCADE (usage 지우면 사진도 사라진다) ==='
-- 별도 usage+사진을 만들어 지운다(위 픽스처는 이후 테스트에 필요하므로 보존).
INSERT INTO public.seoul_service_usages (id, participant_id, allocation_id, usage_date, amount, description)
VALUES ('acf10000-0000-0000-0000-0000000000c9','ac111111-1111-1111-1111-111111111111',
        'ace10000-0000-0000-0000-0000000000a1','2025-03-09',10000,'삭제용 지출')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_activity_photos (id, usage_id, storage_path)
VALUES ('ac700000-0000-0000-0000-0000000000c9','acf10000-0000-0000-0000-0000000000c9',
        'ac111111-1111-1111-1111-111111111111/acf10000-0000-0000-0000-0000000000c9/z.jpg')
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.seoul_service_usages WHERE id='acf10000-0000-0000-0000-0000000000c9';
SELECT '   T1. 지운 usage 의 사진 잔여: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CASCADE' ELSE '  ❌ 안 지워짐' END
  FROM public.seoul_activity_photos WHERE id='ac700000-0000-0000-0000-0000000000c9';

\echo ''
\echo '=== 참여자A 로그인 — 반드시 되어야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'acaaaaaa-0000-0000-0000-0000000000a1';  -- ★ 로그인 id (participants.id 아님)
\echo '── S1. 본인이 자기 활동사진 열람'
SELECT '   내 활동사진: ' || count(*) || '건' ||
       CASE WHEN count(*)=2 THEN '  ✅' ELSE '  ❌ 본인이 못 봄' END
  FROM public.seoul_activity_photos
 WHERE usage_id='acf10000-0000-0000-0000-0000000000a1';
\echo '── S2. 본인이 자기(정산 전) 지출에 활동사진 추가'
INSERT INTO public.seoul_activity_photos (id, usage_id, storage_path, caption)
VALUES ('ac700000-0000-0000-0000-0000000000b1','acf10000-0000-0000-0000-0000000000a1',
        'ac111111-1111-1111-1111-111111111111/acf10000-0000-0000-0000-0000000000a1/3.jpg','본인추가');
SELECT '   본인 추가 성공: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 본인이 막힘' END
  FROM public.seoul_activity_photos WHERE id='ac700000-0000-0000-0000-0000000000b1';
\echo '── S2b. ★경로 위조 차단: 본인이 자기 pending 지출에 남의 접두 경로 삽입 시도 → 트리거 RAISE'
-- RLS 는 본인의 pending 지출이라 허용하지만, storage_path 접두(ac2222…=B)가 지출 소유자(A)와 달라
-- seoul_check_activity_photo_path 트리거가 막아야 한다. 이게 admin 서명 우회 경로위조의 원천 차단.
INSERT INTO public.seoul_activity_photos (id, usage_id, storage_path, caption)
VALUES ('ac700000-0000-0000-0000-0000000000b2','acf10000-0000-0000-0000-0000000000a1',
        'ac222222-2222-2222-2222-222222222222/acf10000-0000-0000-0000-0000000000a1/forged.jpg','위조시도');
SELECT '   위조 경로 삽입 성공 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨(트리거)' ELSE '  ❌ 뚫림(경로위조)' END
  FROM public.seoul_activity_photos WHERE id='ac700000-0000-0000-0000-0000000000b2';
RESET ROLE;

\echo ''
\echo '=== 남(참여자B) — 반드시 막혀야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'acbbbbbb-0000-0000-0000-0000000000b1';
\echo '── S3. 남이 내 활동사진 열람 시도'
SELECT '   B 가 본 A 사진: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_activity_photos WHERE usage_id='acf10000-0000-0000-0000-0000000000a1';
\echo '── S4. 남이 내 지출에 활동사진 삽입 시도'
INSERT INTO public.seoul_activity_photos (id, usage_id, storage_path, caption)
VALUES ('ac700000-0000-0000-0000-0000000000e1','acf10000-0000-0000-0000-0000000000a1',
        'hack/hack.jpg','무단삽입시도');
RESET ROLE;
SELECT '   B 의 무단삽입 성공 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_activity_photos WHERE id='ac700000-0000-0000-0000-0000000000e1';

\echo ''
\echo '=== 담당 실무자 — 반드시 되어야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ac000000-0000-0000-0000-0000000000ff';
\echo '── S5a. 담당 실무자가 내 활동사진 열람'
SELECT '   실무자가 본 A 사진: ' || count(*) ||
       CASE WHEN count(*)>=2 THEN '  ✅' ELSE '  ❌ 실무자가 못 봄' END
  FROM public.seoul_activity_photos WHERE usage_id='acf10000-0000-0000-0000-0000000000a1';
\echo '── S5b. 담당 실무자가 활동사진 추가'
INSERT INTO public.seoul_activity_photos (id, usage_id, storage_path, caption)
VALUES ('ac700000-0000-0000-0000-0000000000f1','acf10000-0000-0000-0000-0000000000a1',
        'ac111111-1111-1111-1111-111111111111/acf10000-0000-0000-0000-0000000000a1/4.jpg','실무자추가');
SELECT '   실무자 추가 성공: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 실무자가 막힘' END
  FROM public.seoul_activity_photos WHERE id='ac700000-0000-0000-0000-0000000000f1';
RESET ROLE;

\echo ''
\echo '=== 활동사진 계약 검증 끝 ==='
