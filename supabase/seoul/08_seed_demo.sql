-- =====================================================================
-- 08. 데모 시드 — 참여자 1명을 신청부터 예산 배정까지 채운다
--
-- 선행 조건: scripts/seed-demo-auth.mjs 를 먼저 실행해 데모 계정 3종을
-- Supabase Auth 에 실제로 만들어 두어야 한다 (관리자/담당자 역할 배정과
-- 당사자 계정 연결이 이메일로 이루어지기 때문). 스크립트를 아직 안 돌렸다면
-- 이 파일은 실행해도 되지만, 계정이 생긴 뒤 로그인해야 실제로 연결된다 —
-- participants_autolink 트리거가 나중에 로그인할 때 채워준다.
--
-- 이메일은 .env.example 의 DEMO_*_EMAIL 기본값과 정확히 일치해야 한다.
-- 다른 이메일을 쓴다면 아래 세 상수만 바꾸면 된다.
-- =====================================================================

DO $$
DECLARE
  v_admin_email       TEXT := 'demo.admin@example.com';
  v_supporter_email   TEXT := 'demo.supporter@example.com';
  v_participant_email TEXT := 'demo.participant@example.com';

  v_supporter_profile_id UUID;
  v_participant_id       UUID;
  v_cohort_id            UUID;
  v_committee_id         UUID;
  v_admin_body_id        UUID;
  v_domain_id            UUID;
  v_application_id       UUID;
  v_decision_id          UUID;
  v_plan_id              UUID;
  v_review_id            UUID;
  v_allocation_id        UUID;
  v_service_id           UUID;
BEGIN
  -- 1. 역할 배정 (계정이 이미 로그인해 profiles 행이 있는 경우에만 반영된다)
  UPDATE public.profiles SET role = 'admin'
   WHERE public.norm_email(email) = public.norm_email(v_admin_email) AND role <> 'admin';

  UPDATE public.profiles SET role = 'supporter'
   WHERE public.norm_email(email) = public.norm_email(v_supporter_email) AND role <> 'supporter';

  SELECT id INTO v_supporter_profile_id
    FROM public.profiles WHERE public.norm_email(email) = public.norm_email(v_supporter_email);

  -- 2. 참여자 등록 — 이미 있으면 담당자만 맞추고 넘어간다
  SELECT id INTO v_participant_id
    FROM public.participants WHERE public.norm_email(email) = public.norm_email(v_participant_email);

  IF v_participant_id IS NULL THEN
    INSERT INTO public.participants (name, email, assigned_supporter_id)
    VALUES ('데모 당사자', v_participant_email, v_supporter_profile_id)
    RETURNING id INTO v_participant_id;
  ELSE
    UPDATE public.participants SET assigned_supporter_id = v_supporter_profile_id
     WHERE id = v_participant_id AND assigned_supporter_id IS DISTINCT FROM v_supporter_profile_id;
  END IF;

  -- 3. 자격 정보
  INSERT INTO public.seoul_disability_profiles (participant_id, primary_disability_type, disability_severity)
  VALUES (v_participant_id, '지적장애', 'severe')
  ON CONFLICT (participant_id) DO NOTHING;

  INSERT INTO public.seoul_benefit_status (participant_id, participates_in_mohw_pilot)
  VALUES (v_participant_id, FALSE)
  ON CONFLICT (participant_id) DO NOTHING;

  -- 4. 참조 데이터 조회 (07_seed_program.sql 이 먼저 실행되어 있어야 한다)
  SELECT id INTO v_cohort_id FROM public.seoul_cohorts WHERE code = '2026_3';
  SELECT id INTO v_committee_id FROM public.seoul_review_committees LIMIT 1;
  SELECT id INTO v_admin_body_id FROM public.seoul_administering_bodies WHERE name = '서울특별시';
  SELECT id INTO v_domain_id FROM public.seoul_service_domains WHERE code = 'self_development';

  IF v_cohort_id IS NULL THEN
    RAISE EXCEPTION '07_seed_program.sql 을 먼저 실행하세요 (seoul_cohorts 없음)';
  END IF;

  -- 5. 신청 → 동의 2건 → 선정
  SELECT id INTO v_application_id
    FROM public.seoul_applications WHERE participant_id = v_participant_id AND cohort_id = v_cohort_id;

  IF v_application_id IS NULL THEN
    INSERT INTO public.seoul_applications (participant_id, cohort_id, receipt_number, status)
    VALUES (v_participant_id, v_cohort_id, 'DEMO-0001', 'selected')
    RETURNING id INTO v_application_id;
  END IF;

  INSERT INTO public.seoul_consent_records (application_id, participant_id, consent_type, is_agreed)
  VALUES
    (v_application_id, v_participant_id, 'general', TRUE),
    (v_application_id, v_participant_id, 'unique_id', TRUE)
  ON CONFLICT (application_id, consent_type) DO NOTHING;

  SELECT id INTO v_decision_id
    FROM public.seoul_selection_decisions WHERE application_id = v_application_id;

  IF v_decision_id IS NULL THEN
    INSERT INTO public.seoul_selection_decisions (application_id, is_selected, selection_reason, decided_by_id)
    VALUES (v_application_id, TRUE, '데모 시드 — 자동 선정', v_admin_body_id)
    RETURNING id INTO v_decision_id;
  END IF;

  -- 6. 이용계획 (당사자가 직접 세운 것으로 표시 — authored_with_support='self')
  SELECT id INTO v_plan_id
    FROM public.seoul_utilization_plans WHERE application_id = v_application_id;

  IF v_plan_id IS NULL THEN
    INSERT INTO public.seoul_utilization_plans
      (participant_id, application_id, cohort_id, authored_with_support, status, plan_period_start, plan_period_end)
    VALUES
      (v_participant_id, v_application_id, v_cohort_id, 'self', 'approved', '2026-01-01', '2026-06-30')
    RETURNING id INTO v_plan_id;
  END IF;

  INSERT INTO public.seoul_self_narratives
    (plan_id, strengths_talents, desired_life, goal_to_try, written_in_first_person)
  VALUES
    (v_plan_id, '그림 그리기, 사람들과 이야기하기', '내 힘으로 그림을 배워 웹툰을 그리고 싶다', '태블릿으로 그림 연습 시작하기', TRUE)
  ON CONFLICT (plan_id) DO NOTHING;

  SELECT id INTO v_service_id
    FROM public.seoul_requested_services WHERE plan_id = v_plan_id AND priority = 1;

  IF v_service_id IS NULL THEN
    INSERT INTO public.seoul_requested_services
      (plan_id, priority, service_name, domain_id, estimated_cost, approved_for_service)
    VALUES
      (v_plan_id, 1, '그림 태블릿 구입 및 온라인 강좌', v_domain_id, 450000, TRUE)
    RETURNING id INTO v_service_id;
  END IF;

  -- 7. 심의 → 예산 배정
  SELECT id INTO v_review_id FROM public.seoul_plan_reviews WHERE plan_id = v_plan_id;

  IF v_review_id IS NULL THEN
    INSERT INTO public.seoul_plan_reviews (plan_id, committee_id, decision, review_date)
    VALUES (v_plan_id, v_committee_id, 'approved', CURRENT_DATE)
    RETURNING id INTO v_review_id;
  END IF;

  SELECT id INTO v_allocation_id FROM public.seoul_budget_allocations WHERE plan_id = v_plan_id;

  IF v_allocation_id IS NULL THEN
    INSERT INTO public.seoul_budget_allocations
      (participant_id, plan_id, review_id, cohort_id, funded_by_id,
       monthly_ceiling, total_ceiling, period_months, carry_over_allowed,
       allocated_amount, starts_on, ends_on)
    SELECT
      v_participant_id, v_plan_id, v_review_id, v_cohort_id, v_admin_body_id,
      c.monthly_ceiling, c.total_ceiling, c.period_months, c.carry_over_allowed,
      c.total_ceiling, c.starts_on, c.ends_on
      FROM public.seoul_cohorts c WHERE c.id = v_cohort_id
    RETURNING id INTO v_allocation_id;
  END IF;

  -- 8. 이용 내역 2건 — 계획대로 쓴 것 1건 + 계획에 없던 것 1건(차단이 아니라 플래그 시연용)
  IF NOT EXISTS (SELECT 1 FROM public.seoul_service_usages WHERE allocation_id = v_allocation_id) THEN
    INSERT INTO public.seoul_service_usages
      (participant_id, allocation_id, requested_service_id, domain_id, usage_date, amount, description, decided_by)
    VALUES
      (v_participant_id, v_allocation_id, v_service_id, v_domain_id, CURRENT_DATE - 10, 220000,
       '그림 태블릿 구입', 'self'),
      (v_participant_id, v_allocation_id, NULL, v_domain_id, CURRENT_DATE - 3, 30000,
       '동네 미술 학원 1회 체험', 'self_with_support');
  END IF;

  RAISE NOTICE '데모 시드 완료 — 참여자 id: %', v_participant_id;
END $$;
