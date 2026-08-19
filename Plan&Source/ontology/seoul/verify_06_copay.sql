-- =====================================================================
-- 검증 06 — 본인부담금 산정 (seoul_set_copay 트리거)
--
-- 3차(2026) 모집 안내문이 정한 규칙을 실제 트리거 실행으로 확인한다.
--   "기초생활수급자·차상위계층 본인부담금 없음(0원)
--    그 외 참여자 지원액의 10%(최대 24만 원)"
--
-- 확인 항목
--   C1. 일반 참여자(수급 아님) — 승인금액 240만 → 24만원 부과
--   C2. 기초생활수급자 — 0원 면제
--   C3. 차상위계층 — 0원 면제
--   C4. 상한 적용 — 승인금액이 커도 copay_max(24만)를 넘지 않는다
--   C5. 수급 구분 미입력 — 0원으로 넘기지 않고 'unverified' 로 남긴다
--   C6. 본인부담금 제도가 없는 차수(1·2차) — 'not_applicable', 면제와 구분된다
--   C7. 승인금액을 나중에 고쳐도 재산정된다 (UPDATE 경로)
--   C8. 본인부담금은 remaining 에서 차감되지 않는다 (쓸 수 있는 돈과 낼 돈은 다른 축)
--
-- ID 는 다른 검증 파일과 겹치지 않게 9-접두 UUID 를 쓴다.
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00~05 → 이 파일
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── 픽스처 ────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('90000000-0000-0000-0000-000000000001','copay-a@test.local'),
  ('90000000-0000-0000-0000-000000000002','copay-b@test.local'),
  ('90000000-0000-0000-0000-000000000003','copay-c@test.local'),
  ('90000000-0000-0000-0000-000000000004','copay-d@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('90000000-0000-0000-0000-000000000001','participant','일반참여자'),
  ('90000000-0000-0000-0000-000000000002','participant','기초수급자'),
  ('90000000-0000-0000-0000-000000000003','participant','차상위계층'),
  ('90000000-0000-0000-0000-000000000004','participant','수급구분미입력')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id) VALUES
  ('91111111-1111-1111-1111-111111111111','일반참여자',    '90000000-0000-0000-0000-000000000001'),
  ('91111111-2222-2222-2222-222222222222','기초수급자',    '90000000-0000-0000-0000-000000000002'),
  ('91111111-3333-3333-3333-333333333333','차상위계층',    '90000000-0000-0000-0000-000000000003'),
  ('91111111-4444-4444-4444-444444444444','수급구분미입력','90000000-0000-0000-0000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- 수급 구분 — D 는 일부러 넣지 않는다 (C5 미확인 시나리오)
INSERT INTO public.seoul_benefit_status (participant_id, public_assistance) VALUES
  ('91111111-1111-1111-1111-111111111111','none'),
  ('91111111-2222-2222-2222-222222222222','basic_livelihood'),
  ('91111111-3333-3333-3333-333333333333','near_poor')
ON CONFLICT (participant_id) DO UPDATE SET public_assistance = EXCLUDED.public_assistance;

-- 3차 = 본인부담 10% / 상한 24만.  2차 = 제도 없음(rate 0).
INSERT INTO public.seoul_cohorts
  (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed,
   copay_rate, copay_max, appeal_due_days, starts_on, ends_on)
VALUES
  ('92222222-0000-0000-0000-000000000003','test_2026_3','검증용 3차',6,400000,2400000,TRUE,
   0.10,240000,14,'2026-01-01','2026-12-31'),
  ('92222222-0000-0000-0000-000000000002','test_2025_2','검증용 2차(부담금 없음)',6,400000,2400000,TRUE,
   0,NULL,14,'2025-01-01','2025-12-31')
ON CONFLICT (code) DO NOTHING;

-- 배정에 필요한 신청·계획 (심의 흐름 자체는 verify_04 담당)
INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number)
SELECT ('93000000-0000-0000-0000-00000000000' || n)::uuid,
       p.pid::uuid, c.cid::uuid, 'CP-00' || n
  FROM (VALUES
    (1,'91111111-1111-1111-1111-111111111111','92222222-0000-0000-0000-000000000003'),
    (2,'91111111-2222-2222-2222-222222222222','92222222-0000-0000-0000-000000000003'),
    (3,'91111111-3333-3333-3333-333333333333','92222222-0000-0000-0000-000000000003'),
    (4,'91111111-4444-4444-4444-444444444444','92222222-0000-0000-0000-000000000003'),
    (5,'91111111-1111-1111-1111-111111111111','92222222-0000-0000-0000-000000000002')
  ) AS t(n, pid, cid), LATERAL (SELECT t.pid) AS p(pid), LATERAL (SELECT t.cid) AS c(cid)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status)
SELECT ('94000000-0000-0000-0000-00000000000' || n)::uuid, a.participant_id, a.id, a.cohort_id, 'approved'
  FROM public.seoul_applications a
  JOIN (VALUES (1),(2),(3),(4),(5)) AS t(n)
    ON a.id = ('93000000-0000-0000-0000-00000000000' || t.n)::uuid
ON CONFLICT (id) DO NOTHING;


\echo ''
\echo '=== C1~C6. 승인금액 240만원으로 배정하고 산정 결과를 본다 ==='
INSERT INTO public.seoul_budget_allocations
  (id, participant_id, plan_id, cohort_id, monthly_ceiling, total_ceiling, period_months,
   carry_over_allowed, allocated_amount, starts_on, ends_on)
SELECT ('95000000-0000-0000-0000-00000000000' || t.n)::uuid,
       pl.participant_id, pl.id, pl.cohort_id, 400000, 2400000, 6, TRUE,
       2400000, '2026-01-01', '2026-06-30'
  FROM public.seoul_utilization_plans pl
  JOIN (VALUES (1),(2),(3),(4),(5)) AS t(n)
    ON pl.id = ('94000000-0000-0000-0000-00000000000' || t.n)::uuid
ON CONFLICT (id) DO NOTHING;

SELECT p.name                                   AS "참여자",
       COALESCE(bs.public_assistance,'(미입력)') AS "수급구분",
       c.code                                   AS "차수",
       to_char(a.allocated_amount,'FM999,999,999') AS "승인금액",
       to_char(a.copay_amount,'FM999,999,999')     AS "본인부담금",
       a.copay_status                           AS "상태"
  FROM public.seoul_budget_allocations a
  JOIN public.participants p       ON p.id = a.participant_id
  JOIN public.seoul_cohorts  c     ON c.id = a.cohort_id
  LEFT JOIN public.seoul_benefit_status bs ON bs.participant_id = a.participant_id
 WHERE a.id::text LIKE '95000000%'
 ORDER BY a.id;

\echo '-- 기대: 일반=240,000/charged · 기초=0/exempt_basic_livelihood · 차상위=0/exempt_near_poor'
\echo '--       미입력=240,000/unverified · 2차=0/not_applicable'

SELECT CASE WHEN count(*) = 5 THEN '   C1~C6 판정: ✅' ELSE '   C1~C6 판정: ❌ (' || count(*) || '/5)' END
  FROM public.seoul_budget_allocations a
  JOIN public.seoul_cohorts c ON c.id = a.cohort_id
 WHERE a.id::text LIKE '95000000%'
   AND (   (a.participant_id = '91111111-1111-1111-1111-111111111111' AND c.code='test_2026_3'
            AND a.copay_amount = 240000 AND a.copay_status = 'charged')
        OR (a.participant_id = '91111111-2222-2222-2222-222222222222'
            AND a.copay_amount = 0 AND a.copay_status = 'exempt_basic_livelihood')
        OR (a.participant_id = '91111111-3333-3333-3333-333333333333'
            AND a.copay_amount = 0 AND a.copay_status = 'exempt_near_poor')
        OR (a.participant_id = '91111111-4444-4444-4444-444444444444'
            AND a.copay_amount = 240000 AND a.copay_status = 'unverified')
        OR (c.code = 'test_2025_2' AND a.copay_amount = 0 AND a.copay_status = 'not_applicable'));


\echo ''
\echo '=== C4. 상한 — 승인금액 300만이어도 24만을 넘지 않아야 함 ==='
UPDATE public.seoul_cohorts   SET total_ceiling = 3000000 WHERE code = 'test_2026_3';
UPDATE public.seoul_budget_allocations
   SET total_ceiling = 3000000, allocated_amount = 3000000
 WHERE id = '95000000-0000-0000-0000-000000000001';

SELECT '   승인 3,000,000 → 부담금 ' || to_char(copay_amount,'FM999,999,999') || '원  '
       || CASE WHEN copay_amount = 240000 THEN '✅ (상한 적용)' ELSE '❌' END
  FROM public.seoul_budget_allocations WHERE id = '95000000-0000-0000-0000-000000000001';


\echo ''
\echo '=== C7. 승인금액을 줄이면 재산정되어야 함 (100만 → 10만) ==='
UPDATE public.seoul_budget_allocations
   SET allocated_amount = 1000000
 WHERE id = '95000000-0000-0000-0000-000000000001';

SELECT '   승인 1,000,000 → 부담금 ' || to_char(copay_amount,'FM999,999,999') || '원  '
       || CASE WHEN copay_amount = 100000 THEN '✅' ELSE '❌' END
  FROM public.seoul_budget_allocations WHERE id = '95000000-0000-0000-0000-000000000001';


\echo ''
\echo '=== C8. 잔액 기준은 차수 상한이 아니라 승인금액이어야 함 ==='
-- 지금 이 배정은 차수 상한 3,000,000 / 승인금액 1,000,000 인 부분 승인 상태다.
-- 잔액이 3,000,000 으로 나오면 당사자에게 200만원을 더 쓸 수 있다고 잘못 알려주는 것이다.
SELECT '   차수상한 ' || to_char(total_ceiling,'FM999,999,999')
       || ' / 승인 '   || to_char(allocated_amount,'FM999,999,999')
       || ' / 잔액 '   || to_char(remaining,'FM999,999,999') || '  '
       || CASE WHEN remaining = 1000000 THEN '✅ (승인금액 기준)' ELSE '❌ (차수 상한 기준)' END
  FROM public.v_seoul_budget_balance
 WHERE allocation_id = '95000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== C9. 본인부담금은 잔액에서 차감되지 않아야 함 (쓸 수 있는 돈 ≠ 낼 돈) ==='
SELECT '   승인 ' || to_char(allocated_amount,'FM999,999,999')
       || ' / 부담금 ' || to_char(copay_amount,'FM999,999,999')
       || ' / 잔액 '   || to_char(remaining,'FM999,999,999') || '  '
       || CASE WHEN remaining = allocated_amount THEN '✅ (별개 축)' ELSE '❌ (잔액에서 차감됨)' END
  FROM public.v_seoul_budget_balance
 WHERE allocation_id = '95000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== C11. 수급현황을 뒤늦게 입력하면 unverified 배정이 면제로 다시 잡혀야 함 ==='
-- 참여자D 는 지금 unverified / 240,000 상태다. 기초생활수급으로 확인해 준다.
INSERT INTO public.seoul_benefit_status (participant_id, public_assistance)
VALUES ('91111111-4444-4444-4444-444444444444','basic_livelihood')
ON CONFLICT (participant_id) DO UPDATE SET public_assistance = EXCLUDED.public_assistance;

SELECT '   확인 후 → ' || to_char(copay_amount,'FM999,999,999') || '원 / ' || copay_status || '  '
       || CASE WHEN copay_amount = 0 AND copay_status = 'exempt_basic_livelihood'
               THEN '✅' ELSE '❌' END
  FROM public.seoul_budget_allocations WHERE id = '95000000-0000-0000-0000-000000000004';

\echo ''
\echo '=== C12. 이미 확정된 배정은 나중의 자격 변동으로 소급 변경되지 않아야 함 ==='
-- 참여자B 는 exempt_basic_livelihood 로 확정돼 있다. 수급이 끊긴 것으로 바꿔도
-- 이미 승인된 배정의 부담금은 0원 그대로여야 한다.
UPDATE public.seoul_benefit_status
   SET public_assistance = 'none'
 WHERE participant_id = '91111111-2222-2222-2222-222222222222';

SELECT '   자격 변동 후 → ' || to_char(copay_amount,'FM999,999,999') || '원 / ' || copay_status || '  '
       || CASE WHEN copay_amount = 0 AND copay_status = 'exempt_basic_livelihood'
               THEN '✅ (소급 변경 없음)' ELSE '❌ (소급 변경됨)' END
  FROM public.seoul_budget_allocations WHERE id = '95000000-0000-0000-0000-000000000002';


\echo ''
\echo '=== C10. 부분 승인 시 승인금액 초과 지출은 차단되어야 함 ==='
-- 차수 상한은 3,000,000 이지만 승인은 1,000,000 이다. 1,200,000 지출은 막혀야 한다.
INSERT INTO public.seoul_service_usages
  (participant_id, allocation_id, usage_date, amount, description, created_by, decided_by)
VALUES ('91111111-1111-1111-1111-111111111111','95000000-0000-0000-0000-000000000001',
        '2026-02-01', 1200000, '승인금액 초과 테스트', '90000000-0000-0000-0000-000000000001','self');
-- 기대: "승인된 금액을 초과합니다. (승인 1,000,000원 / 기사용 0원 / 이번 1,200,000원)"
--       차수 상한(3,000,000)을 기준으로 통과되면 안 된다.
