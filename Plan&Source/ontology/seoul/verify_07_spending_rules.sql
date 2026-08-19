-- =====================================================================
-- 검증 07 — 지원 불가 항목: 판정이 아니라 명시·기록
--
-- 기관 확인 결과 확정된 설계:
--   "지원 불가 여부는 수행기관 서류를 근거로 심사처가 결정한다. 결정 전 당사자와
--    담당자의 대화에서 자정될 가능성이 높으므로 명시 수준으로만 두어도 된다.
--    신청·이의신청은 기록이 목적이므로 엄격한 판정은 불필요하다."
--
-- 확인 항목
--   E1. 지원 불가 키워드가 들어간 지출도 차단되지 않고 기록된다
--   E2. 그 지출은 검토 대기열(seoul_rule_checks)에 needs_review 로 남는다
--   E3. 근거(source_note)가 실제 안내문을 가리킨다 — 이의신청에서 버텨야 한다
--   E4. 근거 없던 이전 규칙 3종은 비활성화되어 더 이상 걸리지 않는다
--   E5. 구조적 차단(소유권·기간·승인금액)은 그대로 유지된다
--   E6. 사람 판단 항목(⑤ 필요성 설명 부족)은 키워드가 없어 자동으로 걸리지 않는다
--   E7. check_result 에 'blocked' 를 넣을 수 없다 (도달 불가능한 값이므로 제거됨)
--
-- ID 는 다른 검증 파일과 겹치지 않게 a0-접두 UUID 를 쓴다.
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00~05 → 이 파일
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── 픽스처 ────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001','rules-a@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('a0000000-0000-0000-0000-000000000001','participant','규칙검증참여자')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.participants (id, name, auth_user_id) VALUES
  ('a1111111-1111-1111-1111-111111111111','규칙검증참여자','a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_cohorts
  (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed,
   copay_rate, copay_max, appeal_due_days, starts_on, ends_on)
VALUES
  ('a2222222-0000-0000-0000-000000000001','test_rules','검증용 규칙 차수',6,400000,2400000,TRUE,
   0.10,240000,14,'2026-01-01','2026-12-31')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number)
VALUES ('a3000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111',
        'a2222222-0000-0000-0000-000000000001','RL-001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status)
VALUES ('a4000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111',
        'a3000000-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000001','approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_budget_allocations
  (id, participant_id, plan_id, cohort_id, monthly_ceiling, total_ceiling, period_months,
   carry_over_allowed, allocated_amount, starts_on, ends_on)
VALUES ('a5000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111',
        'a4000000-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000001',
        400000, 2400000, 6, TRUE, 2400000, '2026-01-01','2026-06-30')
ON CONFLICT (id) DO NOTHING;


\echo ''
\echo '=== E1. 지원 불가 키워드가 들어간 지출 — 차단되지 않고 기록되어야 함 ==='
INSERT INTO public.seoul_service_usages
  (id, participant_id, allocation_id, usage_date, amount, description, created_by, decided_by)
VALUES ('a6000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111',
        'a5000000-0000-0000-0000-000000000001','2026-02-01', 50000,
        '가족 여행 숙박비', 'a0000000-0000-0000-0000-000000000001','self');

SELECT '   기록된 건수: ' || count(*) || '  '
       || CASE WHEN count(*) = 1 THEN '✅ (막지 않음)' ELSE '❌ (차단됨)' END
  FROM public.seoul_service_usages WHERE id = 'a6000000-0000-0000-0000-000000000001';


\echo ''
\echo '=== E2. 검토 대기열에 needs_review 로 남아야 함 ==='
SELECT '   ' || r.label || ' → ' || rc.check_result || '/' || rc.human_decision || '  ✅'
  FROM public.seoul_rule_checks rc
  JOIN public.seoul_spending_rules r ON r.id = rc.rule_id
 WHERE rc.usage_id = 'a6000000-0000-0000-0000-000000000001'
 ORDER BY r.code;

SELECT CASE WHEN count(*) >= 1 THEN '   E2 판정: ✅ (기록 남음)' ELSE '   E2 판정: ❌ (기록 없음)' END
  FROM public.seoul_rule_checks rc
  JOIN public.seoul_spending_rules r ON r.id = rc.rule_id
 WHERE rc.usage_id = 'a6000000-0000-0000-0000-000000000001'
   AND r.code = 'excluded_leisure'
   AND rc.check_result = 'needs_review'
   AND rc.human_decision = 'pending';


\echo ''
\echo '=== E3. 근거가 실제 안내문을 가리켜야 함 ==='
SELECT '   ' || code || ' → ' || source_note
  FROM public.seoul_spending_rules
 WHERE is_active AND kind = 'prohibition'
 ORDER BY code;

SELECT CASE WHEN count(*) = 4 THEN '   E3 판정: ✅ (4종 모두 안내문 근거)'
            ELSE '   E3 판정: ❌ (' || count(*) || '/4)' END
  FROM public.seoul_spending_rules
 WHERE is_active AND kind = 'prohibition'
   AND source_note LIKE '2026년 3차 모집 안내문%';


\echo ''
\echo '=== E4. 근거 없던 이전 규칙 3종은 활성 상태로 남아 있으면 안 됨 ==='
INSERT INTO public.seoul_service_usages
  (id, participant_id, allocation_id, usage_date, amount, description, created_by, decided_by)
VALUES ('a6000000-0000-0000-0000-000000000002','a1111111-1111-1111-1111-111111111111',
        'a5000000-0000-0000-0000-000000000001','2026-02-02', 10000,
        '주류 구입', 'a0000000-0000-0000-0000-000000000001','self');

SELECT '   활성 상태인 이전 규칙 수: ' || count(*) || '  '
       || CASE WHEN count(*) = 0 THEN '✅' ELSE '❌' END
  FROM public.seoul_spending_rules
 WHERE code IN ('no_alcohol_tobacco_lottery','no_tax_utility','no_saving_debt')
   AND is_active;

-- must_be_in_plan(계획에 없는 지출)은 별개 요건이라 걸리는 게 정상이다.
-- 여기서 보는 것은 '지원 불가 항목(prohibition)' 이 걸렸는지뿐이다.
SELECT '   "주류 구입" 에 걸린 지원불가 규칙 수: ' || count(*) || '  '
       || CASE WHEN count(*) = 0 THEN '✅ (근거 없는 규칙은 안 걸림)' ELSE '❌' END
  FROM public.seoul_rule_checks rc
  JOIN public.seoul_spending_rules r ON r.id = rc.rule_id
 WHERE rc.usage_id = 'a6000000-0000-0000-0000-000000000002'
   AND r.kind = 'prohibition';


\echo ''
\echo '=== E4b. 업그레이드 경로 — 이미 배포된 DB 의 레거시 규칙이 비활성화되는가 ==='
-- 기존 배포본에는 이 3종이 활성 상태로 들어 있다. 03_seoul_schema.sql 을 다시
-- 실행하면(README 가 보장하는 재실행 가능성) 비활성화되어야 한다.
-- DELETE 가 아니라 UPDATE 인 이유: rule_id 가 ON DELETE CASCADE 라 지우면
-- 이미 쌓인 검토 이력까지 함께 사라진다.
INSERT INTO public.seoul_spending_rules (code, label, kind, enforcement, keywords, source_note, is_active)
VALUES ('no_alcohol_tobacco_lottery', '주류·담배·복권 구입 불가', 'prohibition', 'block',
        ARRAY['주류','술','담배'], '서울형 시범사업 지원 불가 항목', TRUE)
ON CONFLICT (cohort_id, code) DO UPDATE SET is_active = TRUE, enforcement = 'block';

SELECT '   재실행 전: is_active = ' || is_active
  FROM public.seoul_spending_rules WHERE code = 'no_alcohol_tobacco_lottery';

\i supabase/seoul/03_seoul_schema.sql

SELECT '   재실행 후: is_active = ' || is_active || '  '
       || CASE WHEN is_active = FALSE THEN '✅ (비활성화됨)' ELSE '❌ (여전히 활성)' END
  FROM public.seoul_spending_rules WHERE code = 'no_alcohol_tobacco_lottery';


\echo ''
\echo '=== E6. 사람 판단 항목(⑤ 필요성 설명 부족)은 자동으로 걸리지 않아야 함 ==='
SELECT '   excluded_unexplained 자동 판정 건수: ' || count(*) || '  '
       || CASE WHEN count(*) = 0 THEN '✅ (키워드 없음 — 심사처 판단)' ELSE '❌' END
  FROM public.seoul_rule_checks rc
  JOIN public.seoul_spending_rules r ON r.id = rc.rule_id
 WHERE r.code = 'excluded_unexplained';


\echo ''
\echo '=== E5. 구조적 차단은 그대로 유지되어야 함 ==='
\echo '── E5a. 승인금액 초과'
INSERT INTO public.seoul_service_usages
  (participant_id, allocation_id, usage_date, amount, description, created_by, decided_by)
VALUES ('a1111111-1111-1111-1111-111111111111','a5000000-0000-0000-0000-000000000001',
        '2026-02-03', 9000000, '초과 지출', 'a0000000-0000-0000-0000-000000000001','self');
-- 기대: "승인된 금액을 초과합니다."

\echo '── E5b. 지원 기간 밖'
INSERT INTO public.seoul_service_usages
  (participant_id, allocation_id, usage_date, amount, description, created_by, decided_by)
VALUES ('a1111111-1111-1111-1111-111111111111','a5000000-0000-0000-0000-000000000001',
        '2027-01-01', 10000, '기간 밖', 'a0000000-0000-0000-0000-000000000001','self');
-- 기대: "이용일(2027-01-01)이 예산 지원 기간(...) 밖입니다."


\echo ''
\echo '=== E7. check_result 에 blocked 를 넣을 수 없어야 함 (도달 불가 값 제거) ==='
INSERT INTO public.seoul_rule_checks (usage_id, rule_id, check_result, human_decision)
SELECT 'a6000000-0000-0000-0000-000000000002', id, 'blocked', 'pending'
  FROM public.seoul_spending_rules WHERE code = 'excluded_medical';
-- 기대: check constraint 위반으로 실패해야 한다.
