-- =====================================================================
-- 검증 · 라이프사이클 통합 E2E — 신청→선정→계획→심의→통지→배정→지출→정산
--
-- 목적: 하네스 §9 성공기준의 마지막 미충족 항목 = "핵심 플로우 E2E 통과"를 DB 계층 계약으로 잠근다.
-- 이 스택에서 라이프사이클은 상태컬럼·RLS·트리거·뷰(v_seoul_pipeline)에 산다 → 진짜 통합 검증은 여기다.
-- (vitest+목킹은 배선만 보고 실제 RLS/상태전이/집계를 못 본다 — ⓓ-2 의 실질 실현은 db-verify 하네스.)
--
-- ★성격: 이미 구현된 파이프라인의 회귀잠금(characterization) — GREEN 이어야 정상.
--   ❌ 가 나오면 그게 회귀/공백 발견이다(RED 목표가 아님, audit_log verify 와 대비).
--
-- 실행: verify_02_rls 등과 동일. seoul 00~05(+07·09·10) 적용 뒤 이 파일. 자체 시드(lc* 프리픽스).
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── 시드: 참여자 '라이프'(전 단계 완주) + '타인'(RLS 교차확인용) ───────────────
INSERT INTO auth.users (id, email) VALUES
  ('1c000000-0000-0000-0000-0000000000a1','lc-life-login@test.local'),
  ('1c000000-0000-0000-0000-0000000000a2','lc-other-login@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, name) VALUES
  ('1c000000-0000-0000-0000-0000000000a1','participant','라이프'),
  ('1c000000-0000-0000-0000-0000000000a2','participant','타인')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, name=EXCLUDED.name;
INSERT INTO public.participants (id, name, auth_user_id) VALUES
  ('1c100000-0000-0000-0000-000000000001','라이프','1c000000-0000-0000-0000-0000000000a1'),
  ('1c100000-0000-0000-0000-000000000002','타인','1c000000-0000-0000-0000-0000000000a2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_cohorts (id, code, name, period_months, monthly_ceiling, total_ceiling,
                                  carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES ('1c200000-0000-0000-0000-000000000001','test_lifecycle','E2E차수',6,400000,2400000,TRUE,14,'2025-01-01','2025-06-30')
ON CONFLICT (code) DO NOTHING;

-- 1) 신청 → 2) 동의(general+unique_id, 선정 전제 트리거 seoul_enforce_consent_precondition) → 3) 선정
INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number, status) VALUES
  ('1c300000-0000-0000-0000-000000000001','1c100000-0000-0000-0000-000000000001','1c200000-0000-0000-0000-000000000001','LC-001','selected')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_consent_records (id, application_id, participant_id, consent_type, is_agreed, consent_date, signed_by_proxy) VALUES
  ('1c305000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000001','1c100000-0000-0000-0000-000000000001','general',  TRUE,'2025-01-03',FALSE),
  ('1c305000-0000-0000-0000-000000000002','1c300000-0000-0000-0000-000000000001','1c100000-0000-0000-0000-000000000001','unique_id',TRUE,'2025-01-03',FALSE)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_selection_decisions (id, application_id, is_selected, selection_date) VALUES
  ('1c310000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000001',TRUE,'2025-01-05')
ON CONFLICT (id) DO NOTHING;

-- 3) 계획 + 자기서술 + 사정(domain) + 요청서비스(domain)
INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status,
       plan_period_start, plan_period_end) VALUES
  ('1c400000-0000-0000-0000-000000000001','1c100000-0000-0000-0000-000000000001','1c300000-0000-0000-0000-000000000001','1c200000-0000-0000-0000-000000000001','approved','2025-01-01','2025-06-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_self_narratives (id, plan_id, strengths_talents, goal_to_try) VALUES
  ('1c410000-0000-0000-0000-000000000001','1c400000-0000-0000-0000-000000000001','사람들과 어울리기를 좋아해요','동아리 활동을 해보고 싶어요')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_needs_assessment (id, participant_id, program, domain_id, need_hope) VALUES
  ('1c420000-0000-0000-0000-000000000001','1c100000-0000-0000-0000-000000000001','seoul',
     (SELECT id FROM public.seoul_service_domains WHERE code='social_life' AND program='seoul'),'친구를 만나고 싶어요')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_requested_services (id, plan_id, priority, service_name, domain_id, estimated_cost) VALUES
  ('1c430000-0000-0000-0000-000000000001','1c400000-0000-0000-0000-000000000001',1,'동아리 참가비',
     (SELECT id FROM public.seoul_service_domains WHERE code='social_life' AND program='seoul'),100000)
ON CONFLICT (id) DO NOTHING;

-- 4) 심의(승인) → 5) 통지
INSERT INTO public.seoul_plan_reviews (id, plan_id, decision, review_date, reason) VALUES
  ('1c440000-0000-0000-0000-000000000001','1c400000-0000-0000-0000-000000000001','approved','2025-01-10','적정')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_notifications (id, review_id, participant_id, notified_on, is_read_by_participant) VALUES
  ('1c450000-0000-0000-0000-000000000001','1c440000-0000-0000-0000-000000000001','1c100000-0000-0000-0000-000000000001','2025-01-11',FALSE)
ON CONFLICT (id) DO NOTHING;

-- 6) 배정 → 7) 지출(계획 연결·domain) → 8) 정산
INSERT INTO public.seoul_budget_allocations (id, participant_id, plan_id, cohort_id,
       monthly_ceiling, total_ceiling, period_months, carry_over_allowed, allocated_amount, starts_on, ends_on) VALUES
  ('1c500000-0000-0000-0000-000000000001','1c100000-0000-0000-0000-000000000001','1c400000-0000-0000-0000-000000000001','1c200000-0000-0000-0000-000000000001',
     400000,2400000,6,TRUE,2400000,'2025-01-01','2025-06-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_service_usages (id, participant_id, allocation_id, requested_service_id, domain_id, usage_date, amount, description) VALUES
  ('1c600000-0000-0000-0000-000000000001','1c100000-0000-0000-0000-000000000001','1c500000-0000-0000-0000-000000000001',
     '1c430000-0000-0000-0000-000000000001',
     (SELECT id FROM public.seoul_service_domains WHERE code='social_life' AND program='seoul'),'2025-02-01',50000,'동아리 참가비 지출')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_settlements (id, allocation_id, settled_period, accepted_amount, rejected_amount,
       recovered_amount, unused_amount, settled_on) VALUES
  ('1c700000-0000-0000-0000-000000000001','1c500000-0000-0000-0000-000000000001','2025-H1',50000,0,0,2350000,'2025-06-30')
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' L1. 파이프라인 완주 — v_seoul_pipeline 이 전 단계를 한 행에 잇는다'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   신청 selected · 동의·선정됨 · 계획 approved · 심의 approved · 통지·배정 존재: ' ||
  CASE WHEN EXISTS (
    SELECT 1 FROM public.v_seoul_pipeline
     WHERE participant_id='1c100000-0000-0000-0000-000000000001'
       AND application_status='selected' AND is_selected IS TRUE
       AND plan_status='approved' AND review_decision='approved'
       AND allocation_id IS NOT NULL AND notified_on IS NOT NULL)
       THEN '완주 ✅' ELSE '끊김 ❌ (단계 연결/상태 확인)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' L2. 잔액 정합 — remaining = allocated(2,400,000) − spent(50,000) = 2,350,000'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   spent=50000 · remaining=2350000: ' ||
  CASE WHEN EXISTS (SELECT 1 FROM public.v_seoul_pipeline
                     WHERE allocation_id='1c500000-0000-0000-0000-000000000001'
                       AND spent=50000 AND remaining=2350000)
       THEN '정합 ✅' ELSE '불일치 ❌ (v_seoul_budget_balance 집계 확인)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' L3. 분류축 단일성 — 사정·요청서비스·지출이 같은 domain_id(social_life)'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   3노드 domain_id 동일(distinct=1): ' ||
  CASE WHEN (
    SELECT count(DISTINCT d) FROM (
      SELECT domain_id d FROM public.seoul_needs_assessment WHERE id='1c420000-0000-0000-0000-000000000001'
      UNION ALL SELECT domain_id FROM public.seoul_requested_services WHERE id='1c430000-0000-0000-0000-000000000001'
      UNION ALL SELECT domain_id FROM public.seoul_service_usages WHERE id='1c600000-0000-0000-0000-000000000001'
    ) t) = 1
       THEN '단일축 ✅' ELSE '축 어긋남 ❌ (사정→계획→지출 domain 불일치)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' L4. 계획-지출 연결 — 지출이 요청서비스를 참조(계획 내 지출)'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   usage.requested_service_id → 요청서비스: ' ||
  CASE WHEN EXISTS (SELECT 1 FROM public.seoul_service_usages u
                     JOIN public.seoul_requested_services r ON r.id = u.requested_service_id
                    WHERE u.id='1c600000-0000-0000-0000-000000000001')
       THEN '연결됨 ✅' ELSE '고아 ❌ (계획외 지출로 잘못 분류)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' L5. 정산 정합 — 배정에 정산 존재, 승인액=지출액'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   정산 accepted=50000 · unused=2350000: ' ||
  CASE WHEN EXISTS (SELECT 1 FROM public.seoul_settlements
                     WHERE allocation_id='1c500000-0000-0000-0000-000000000001'
                       AND accepted_amount=50000 AND unused_amount=2350000)
       THEN '정합 ✅' ELSE '불일치 ❌' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' L6. ★RLS 종단 — 당사자 본인은 전 파이프라인, 타 당사자는 0행(교차 차단)'
\echo '════════════════════════════════════════════════════════════════'
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

SET ROLE authenticated;
SET request.jwt.claim.sub = '1c000000-0000-0000-0000-0000000000a1';  -- 라이프 본인
SELECT '   [본인] 자기 파이프라인 보임(1행): ' ||
  CASE WHEN (SELECT count(*) FROM public.v_seoul_pipeline
              WHERE participant_id='1c100000-0000-0000-0000-000000000001') = 1
       THEN '보임 ✅' ELSE '안 보임 ❌ (self RLS 종단 확인)' END;
SELECT '   [본인] 자기 지출 보임: ' ||
  CASE WHEN (SELECT count(*) FROM public.seoul_service_usages
              WHERE id='1c600000-0000-0000-0000-000000000001') = 1
       THEN '보임 ✅' ELSE '안 보임 ❌' END;

SET request.jwt.claim.sub = '1c000000-0000-0000-0000-0000000000a2';  -- 타인
SELECT '   [타인] 라이프 파이프라인 0행(교차 차단): ' ||
  CASE WHEN (SELECT count(*) FROM public.v_seoul_pipeline
              WHERE participant_id='1c100000-0000-0000-0000-000000000001') = 0
       THEN '차단됨 ✅' ELSE '노출 ❌ (교차 참여자 RLS 결함)' END;
SELECT '   [타인] 라이프 지출 0행: ' ||
  CASE WHEN (SELECT count(*) FROM public.seoul_service_usages
              WHERE participant_id='1c100000-0000-0000-0000-000000000001') = 0
       THEN '차단됨 ✅' ELSE '노출 ❌' END;
RESET ROLE;

\echo ''
\echo '=== 검증 종료: 위 결과라인에 ❌ 가 하나도 없어야 계약 통과(기구현 파이프라인 회귀잠금) ==='
