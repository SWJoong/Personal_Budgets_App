-- ============================================================
-- Migration 28: care_plans JSONB → support_goals 이관
-- 전제: Migration 24 (support_goals 테이블) 완료 후 실행
-- 멱등성: 이미 support_goals가 있는 care_plan은 건너뜀
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동 실행
-- ============================================================

-- 이관 전 현황 확인 (실행 후 숫자 비교용)
SELECT
  COUNT(*) AS total_care_plans,
  COUNT(*) FILTER (WHERE jsonb_array_length(content->'service_plan') > 0)    AS has_service_plan,
  COUNT(*) FILTER (WHERE jsonb_array_length(content->'desired_services') > 0) AS has_desired_services
FROM care_plans
WHERE
  (jsonb_typeof(content->'service_plan') = 'array' OR
   jsonb_typeof(content->'desired_services') = 'array');

-- ────────────────────────────────────────────────────────────
-- 이관 실행
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  r          RECORD;
  item       JSONB;
  svc        TEXT;
  goal_idx   SMALLINT;
  admin_id   UUID;
  svc_name   TEXT;
  outcome    TEXT;
  strat      TEXT;
  support    TEXT;
BEGIN
  -- creator_id fallback: 가장 오래된 admin 계정 사용
  SELECT id INTO admin_id
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at
  LIMIT 1;

  FOR r IN
    SELECT cp.id, cp.participant_id, cp.creator_id, cp.content
    FROM public.care_plans cp
    WHERE NOT EXISTS (
      SELECT 1 FROM public.support_goals sg WHERE sg.care_plan_id = cp.id
    )
  LOOP
    goal_idx := 1;

    -- ──────────────────────────────────────────────────────
    -- 템플릿 A: service_plan 배열
    -- content.service_plan[].service_name → support_area
    -- content.plan_goal                   → outcome_goal
    -- content.needed_support              → needed_support
    -- item.frequency + item.category      → strategy
    -- ──────────────────────────────────────────────────────
    IF jsonb_typeof(r.content->'service_plan') = 'array'
       AND jsonb_array_length(r.content->'service_plan') > 0 THEN

      FOR item IN
        SELECT * FROM jsonb_array_elements(r.content->'service_plan')
      LOOP
        svc_name := NULLIF(TRIM(COALESCE(item->>'service_name', '')), '');
        CONTINUE WHEN svc_name IS NULL;

        outcome := NULLIF(TRIM(COALESCE(r.content->>'plan_goal', '')), '');
        support := NULLIF(TRIM(COALESCE(r.content->>'needed_support', '')), '');
        strat   := NULLIF(TRIM(
          COALESCE(item->>'frequency', '') ||
          CASE WHEN COALESCE(item->>'category', '') <> ''
               THEN ' (' || (item->>'category') || ')' ELSE '' END
        ), '');

        INSERT INTO public.support_goals (
          care_plan_id, participant_id, order_index,
          support_area, outcome_goal, strategy, needed_support,
          is_active, creator_id
        ) VALUES (
          r.id, r.participant_id, goal_idx,
          svc_name, outcome, strat, support,
          TRUE, COALESCE(r.creator_id, admin_id)
        )
        ON CONFLICT (care_plan_id, order_index) DO NOTHING;

        goal_idx := goal_idx + 1;
      END LOOP;
    END IF;

    -- ──────────────────────────────────────────────────────
    -- 템플릿 B: desired_services 배열 (PCP 형식)
    -- content.desired_services[]  → support_area (1개씩)
    -- content.trial_goals + desired_life → outcome_goal
    -- content.desired_change      → strategy
    -- content.difficulties        → needed_support
    -- ──────────────────────────────────────────────────────
    IF jsonb_typeof(r.content->'desired_services') = 'array'
       AND jsonb_array_length(r.content->'desired_services') > 0 THEN

      outcome := NULLIF(TRIM(
        COALESCE(r.content->>'trial_goals', '') || ' ' ||
        COALESCE(r.content->>'desired_life', '')
      ), '');
      strat   := NULLIF(TRIM(COALESCE(r.content->>'desired_change', '')), '');
      support := NULLIF(TRIM(COALESCE(r.content->>'difficulties', '')), '');

      FOR svc IN
        SELECT * FROM jsonb_array_elements_text(r.content->'desired_services')
      LOOP
        CONTINUE WHEN svc IS NULL OR TRIM(svc) = '';

        INSERT INTO public.support_goals (
          care_plan_id, participant_id, order_index,
          support_area, outcome_goal, strategy, needed_support,
          is_active, creator_id
        ) VALUES (
          r.id, r.participant_id, goal_idx,
          TRIM(svc), outcome, strat, support,
          TRUE, COALESCE(r.creator_id, admin_id)
        )
        ON CONFLICT (care_plan_id, order_index) DO NOTHING;

        goal_idx := goal_idx + 1;
      END LOOP;
    END IF;

  END LOOP;

  RAISE NOTICE '이관 완료';
END $$;

-- ────────────────────────────────────────────────────────────
-- 이관 결과 확인
-- ────────────────────────────────────────────────────────────
SELECT
  cp.id AS care_plan_id,
  cp.plan_year,
  COUNT(sg.id) AS migrated_goals
FROM care_plans cp
LEFT JOIN support_goals sg ON sg.care_plan_id = cp.id
GROUP BY cp.id, cp.plan_year
ORDER BY cp.plan_year DESC;
