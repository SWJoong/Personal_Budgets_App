-- =====================================================================
-- 검증 05 — Phase 3 리뷰 반영 (seoul_check_usage 예외 메시지)
--
-- 독립 리뷰 에이전트(Phase 3 집행 화면 검토)가 지적한 두 가지를 실제 트리거
-- 실행으로 확인한다 — 코드만 읽고 "될 것"이라 짐작하지 않는다.
--   1) 총 한도·월 한도 초과 메시지의 금액이 천단위 콤마로 나오는지
--      (이전: "2400000.00원" 처럼 NUMERIC 이 그대로 찍혔음)
--   2) 배정 소유자 불일치 메시지에 더 이상 원문 UUID 가 없는지
--      (이전: "예산 배정(71111111-...)의 소유자와..." 형태로 참여자·실무자 모두에게
--       의미 없는 UUID 가 노출됐음)
--
-- ID 는 다른 검증 파일과 겹치지 않게 8-접두 UUID 를 쓴다.
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00~05 → 이 파일
--           (verify_01~04 와 같은 DB 에서 이어 실행해도 무방 — id 가 겹치지 않음)
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
  ('00000000-0000-0000-0000-000000000002','supporter@test.local'),
  ('80000000-0000-0000-0000-000000000001','participant-e-login@test.local'),
  ('80000000-0000-0000-0000-000000000002','participant-f-login@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('00000000-0000-0000-0000-000000000002','supporter','실무자'),
  ('80000000-0000-0000-0000-000000000001','participant','참여자E(로그인)'),
  ('80000000-0000-0000-0000-000000000002','participant','참여자F(로그인)')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('81111111-1111-1111-1111-111111111111','참여자E','80000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002'),
  ('82222222-2222-2222-2222-222222222222','참여자F','80000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 총 한도를 일부러 작게(1,000,000) 잡아 한 번의 지출로 쉽게 넘기도록 한다.
INSERT INTO public.seoul_cohorts
  (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES
  ('83333333-0000-0000-0000-000000000001','test_2025_phase3','검증용 3차수(Phase3)',6,1000000,1000000,TRUE,14,'2025-01-01','2025-06-30')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.seoul_benefit_status (participant_id, participates_in_mohw_pilot) VALUES
  ('81111111-1111-1111-1111-111111111111', FALSE),
  ('82222222-2222-2222-2222-222222222222', FALSE)
ON CONFLICT DO NOTHING;

-- 계획→심의 절차 없이 배정을 직접 만든다 (Phase2 흐름 검증은 verify_04 담당, 여기선 트리거 메시지만 본다).
INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number)
VALUES ('84000000-0000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111',
        '83333333-0000-0000-0000-000000000001','P3-001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status)
VALUES ('84444444-0000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111',
        '84000000-0000-0000-0000-000000000001', '83333333-0000-0000-0000-000000000001','approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_budget_allocations
  (id, participant_id, plan_id, cohort_id, monthly_ceiling, total_ceiling, period_months,
   carry_over_allowed, allocated_amount, starts_on, ends_on)
VALUES
  ('85555555-0000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111',
   '84444444-0000-0000-0000-000000000001','83333333-0000-0000-0000-000000000001',
   1000000, 1000000, 6, TRUE, 1000000, '2025-01-01','2025-06-30')
ON CONFLICT (id) DO NOTHING;


\echo ''
\echo '=== 참여자E 본인 로그인 ==='
SET ROLE alice;
SET request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';

\echo '── R1. 승인금액(1,000,000원)을 넘는 지출 시도 → 메시지에 천단위 콤마가 있어야 함'
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description, created_by, decided_by)
VALUES ('81111111-1111-1111-1111-111111111111','85555555-0000-0000-0000-000000000001',
        '2025-02-01', 1500000, '한도초과 테스트', '80000000-0000-0000-0000-000000000001','self');
-- 기대: 위 INSERT 는 ON_ERROR_STOP off 상태라 실패 메시지를 그대로 출력하고 다음 줄로 넘어간다.
-- 사람이 직접 확인: "승인 1,000,000원 / 기사용 0원 / 이번 1,500,000원" 형태인지,
-- ".00" 이나 콤마 없는 "1000000" 형태가 아닌지 위 ERROR 출력을 눈으로 대조한다.
-- (한도 기준이 차수 상한 → 승인금액으로 바뀌면서 문구도 "승인된 금액을 초과합니다"로 변경됨)

\echo '── R2. 다른 참여자(F) 소유가 아닌 배정에 F 명의로 지출 시도 → 소유자 불일치, UUID 노출 없어야 함'
RESET ROLE;
SET ROLE alice;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description, created_by, decided_by)
VALUES ('82222222-2222-2222-2222-222222222222','85555555-0000-0000-0000-000000000001',
        '2025-02-01', 10000, '소유자 불일치 테스트', '00000000-0000-0000-0000-000000000002','by_supporter');
-- 기대: "이 예산 배정은 다른 참여자의 것이라 지출을 기록할 수 없습니다." — UUID 문자열이 없어야 한다.
RESET ROLE;

\echo ''
\echo '=== 회귀 확인 — 정상 지출은 여전히 성공해야 함 ==='
SET ROLE alice;
SET request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';
INSERT INTO public.seoul_service_usages (id, participant_id, allocation_id, usage_date, amount, description, created_by, decided_by)
VALUES ('86666666-0000-0000-0000-000000000001','81111111-1111-1111-1111-111111111111',
        '85555555-0000-0000-0000-000000000001','2025-02-01', 300000, '정상 지출', '80000000-0000-0000-0000-000000000001','self');
SELECT '   정상 지출: ' || count(*) || '건  ' || CASE WHEN count(*)=1 THEN '✅' ELSE '❌' END
  FROM public.seoul_service_usages WHERE id = '86666666-0000-0000-0000-000000000001';
RESET ROLE;
