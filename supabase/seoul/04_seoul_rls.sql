-- =====================================================================
-- 04. 서울형 RLS — 74개 정책
--
-- 헬퍼 함수(seoul_is_admin/seoul_can_access/seoul_is_staff_for/seoul_is_self)는
-- 01_core.sql §7 에 이미 정의되어 있다. 이 파일은 정책만 둔다.
--
-- ★ 설계 원칙: "본인에 관한 데이터"와 "본인이 쓰는 데이터"는 다르다.
--
--   본인이 쓰는 것   이용계획(작성중) · 지출 기록 · 이의신청 제기
--                    → 참여자가 직접 INSERT/UPDATE 할 수 있어야 한다.
--                      이게 안 되면 "당사자가 스스로 계획·선택·구매한다"는 제도의 전제가 깨진다.
--
--   본인에 관한 것   심의 결과 · 예산 배정 · 통지 · 선정 · 자격정보 · 이의신청 결과
--                    → 참여자는 읽을 수만 있다.
--                      자기 부결 사유를 못 보면 이의신청을 할 수 없으므로 읽기는 반드시 열되,
--                      쓰기를 열면 스스로 한도를 올리거나 기한을 늘릴 수 있다.
--
--   ⚠️ 이 구분을 놓치고 "participant_id 가 있으면 본인 수정 가능"으로 일괄 처리했다가
--      실제 테스트에서 참여자가 예산 한도를 240만 → 9999만원으로 올리고,
--      이의신청 결과를 스스로 '인용'으로 바꾸고, 통지일을 2030년으로 옮겨
--      이의신청 기한을 무한 연장할 수 있는 것이 확인되었다. 아래는 그 수정본이다.
--
--   ★★ 원본 초안에서 발견해 이번에 함께 고친 것: 13곳의 "auth.uid() = participant_id"
--      비교는 participant_id 를 로그인 계정 id로 취급하는 잘못된 가정이었다.
--      participants.id 는 기관이 발급하는 내부 키이지 로그인 계정이 아니다 —
--      실제 참여자는 이 비교로 절대 자기 데이터에 쓸 수 없었다.
--      전부 public.seoul_is_self(participant_id) (auth_user_id 경유) 로 교체했다.
-- =====================================================================

-- ── 참조·코드 테이블: 로그인 사용자 읽기, 관리자만 쓰기 ──────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seoul_cohorts','seoul_service_domains','seoul_spending_rules',
    'seoul_administering_bodies','seoul_executing_agencies',
    'seoul_review_committees','seoul_service_providers'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.seoul_is_admin()) WITH CHECK (public.seoul_is_admin())',
      t || '_admin_write', t);
  END LOOP;
END $$;


-- ── 그룹 A. 행정 기록 — 참여자는 읽기만 ─────────────────────────────
--    자격정보·신청·동의·통지·예산배정·모니터링
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seoul_disability_profiles','seoul_benefit_status','seoul_proxies',
    'seoul_applications','seoul_consent_records','seoul_notifications',
    'seoul_budget_allocations','seoul_monitoring_records'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- 읽기: 본인도 볼 수 있어야 한다 (자기 예산이 얼마인지, 언제 통지받았는지)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.seoul_can_access(participant_id))',
      t || '_select', t);
    -- 쓰기: 담당 실무자·관리자만
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
         WITH CHECK (public.seoul_is_staff_for(participant_id))',
      t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (public.seoul_is_staff_for(participant_id))
         WITH CHECK (public.seoul_is_staff_for(participant_id))',
      t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (public.seoul_is_admin())',
      t || '_delete', t);
  END LOOP;
END $$;


-- ── 그룹 B. 당사자가 직접 쓰는 것 ───────────────────────────────────

-- B-1. 이용계획 — 작성중(draft)일 때만 본인이 고칠 수 있다.
--      제출한 뒤에도 고칠 수 있으면 심의 대상 문서가 사후 변조된다.
ALTER TABLE public.seoul_utilization_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seoul_utilization_plans_select ON public.seoul_utilization_plans;
CREATE POLICY seoul_utilization_plans_select ON public.seoul_utilization_plans
  FOR SELECT TO authenticated
  USING (public.seoul_can_access(participant_id));

DROP POLICY IF EXISTS seoul_utilization_plans_insert ON public.seoul_utilization_plans;
CREATE POLICY seoul_utilization_plans_insert ON public.seoul_utilization_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    public.seoul_is_staff_for(participant_id)
    OR (public.seoul_is_self(participant_id) AND status = 'draft')
  );

DROP POLICY IF EXISTS seoul_utilization_plans_update ON public.seoul_utilization_plans;
CREATE POLICY seoul_utilization_plans_update ON public.seoul_utilization_plans
  FOR UPDATE TO authenticated
  USING (
    public.seoul_is_staff_for(participant_id)
    OR (public.seoul_is_self(participant_id) AND status IN ('draft','submitted'))
  )
  WITH CHECK (
    public.seoul_is_staff_for(participant_id)
    -- 본인은 draft 로 두거나 제출(submitted)까지만 할 수 있다.
    -- 스스로 approved 로 바꾸는 것은 막는다.
    OR (public.seoul_is_self(participant_id) AND status IN ('draft','submitted'))
  );

DROP POLICY IF EXISTS seoul_utilization_plans_delete ON public.seoul_utilization_plans;
CREATE POLICY seoul_utilization_plans_delete ON public.seoul_utilization_plans
  FOR DELETE TO authenticated
  USING (public.seoul_is_admin());

-- B-2. 지출 기록 — 정산 전(pending)까지만 본인이 고칠 수 있다.
ALTER TABLE public.seoul_service_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seoul_service_usages_select ON public.seoul_service_usages;
CREATE POLICY seoul_service_usages_select ON public.seoul_service_usages
  FOR SELECT TO authenticated
  USING (public.seoul_can_access(participant_id));

DROP POLICY IF EXISTS seoul_service_usages_insert ON public.seoul_service_usages;
CREATE POLICY seoul_service_usages_insert ON public.seoul_service_usages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.seoul_is_staff_for(participant_id)
    OR (public.seoul_is_self(participant_id) AND settlement_status = 'pending')
  );

DROP POLICY IF EXISTS seoul_service_usages_update ON public.seoul_service_usages;
CREATE POLICY seoul_service_usages_update ON public.seoul_service_usages
  FOR UPDATE TO authenticated
  USING (
    public.seoul_is_staff_for(participant_id)
    OR (public.seoul_is_self(participant_id) AND settlement_status = 'pending')
  )
  WITH CHECK (
    public.seoul_is_staff_for(participant_id)
    -- 본인이 자기 지출을 '인정'으로 바꿔 정산을 통과시키는 것을 막는다
    OR (public.seoul_is_self(participant_id) AND settlement_status = 'pending')
  );

DROP POLICY IF EXISTS seoul_service_usages_delete ON public.seoul_service_usages;
CREATE POLICY seoul_service_usages_delete ON public.seoul_service_usages
  FOR DELETE TO authenticated
  USING (
    public.seoul_is_staff_for(participant_id)
    OR (public.seoul_is_self(participant_id) AND settlement_status = 'pending')
  );

-- B-3. 이의신청 — 본인이 제기(INSERT)할 수 있어야 한다.
--      단 결과(outcome)는 위원회가 정하므로 본인 UPDATE 는 막는다.
ALTER TABLE public.seoul_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seoul_appeals_select ON public.seoul_appeals;
CREATE POLICY seoul_appeals_select ON public.seoul_appeals
  FOR SELECT TO authenticated
  USING (public.seoul_can_access(participant_id));

-- ★ 실무자만 대신 넣을 수 있다면 그것은 권리 구제가 아니다.
DROP POLICY IF EXISTS seoul_appeals_insert ON public.seoul_appeals;
CREATE POLICY seoul_appeals_insert ON public.seoul_appeals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.seoul_can_access(participant_id)
    AND outcome = 'pending'          -- 제기 시점에는 항상 미결 상태
  );

DROP POLICY IF EXISTS seoul_appeals_update ON public.seoul_appeals;
CREATE POLICY seoul_appeals_update ON public.seoul_appeals
  FOR UPDATE TO authenticated
  USING (public.seoul_is_staff_for(participant_id))
  WITH CHECK (public.seoul_is_staff_for(participant_id));

DROP POLICY IF EXISTS seoul_appeals_delete ON public.seoul_appeals;
CREATE POLICY seoul_appeals_delete ON public.seoul_appeals
  FOR DELETE TO authenticated
  USING (public.seoul_is_admin());


-- ── 그룹 C. 참여자를 간접 참조하는 테이블 ───────────────────────────

-- 나의 상황 · 요청 서비스 — 계획이 draft 일 때만 본인이 고칠 수 있다
ALTER TABLE public.seoul_self_narratives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_self_narratives_select ON public.seoul_self_narratives;
CREATE POLICY seoul_self_narratives_select ON public.seoul_self_narratives
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_utilization_plans p
                  WHERE p.id = plan_id AND public.seoul_can_access(p.participant_id)));
DROP POLICY IF EXISTS seoul_self_narratives_write ON public.seoul_self_narratives;
CREATE POLICY seoul_self_narratives_write ON public.seoul_self_narratives
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_utilization_plans p
                  WHERE p.id = plan_id
                    AND (public.seoul_is_staff_for(p.participant_id)
                         OR (public.seoul_is_self(p.participant_id) AND p.status = 'draft'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seoul_utilization_plans p
                  WHERE p.id = plan_id
                    AND (public.seoul_is_staff_for(p.participant_id)
                         OR (public.seoul_is_self(p.participant_id) AND p.status = 'draft'))));

ALTER TABLE public.seoul_requested_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_requested_services_select ON public.seoul_requested_services;
CREATE POLICY seoul_requested_services_select ON public.seoul_requested_services
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_utilization_plans p
                  WHERE p.id = plan_id AND public.seoul_can_access(p.participant_id)));
DROP POLICY IF EXISTS seoul_requested_services_write ON public.seoul_requested_services;
CREATE POLICY seoul_requested_services_write ON public.seoul_requested_services
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_utilization_plans p
                  WHERE p.id = plan_id
                    AND (public.seoul_is_staff_for(p.participant_id)
                         OR (public.seoul_is_self(p.participant_id) AND p.status = 'draft'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seoul_utilization_plans p
                  WHERE p.id = plan_id
                    AND (public.seoul_is_staff_for(p.participant_id)
                         OR (public.seoul_is_self(p.participant_id) AND p.status = 'draft'))));

-- 영수증 — 본인이 올릴 수 있어야 한다 (정산 전까지)
ALTER TABLE public.seoul_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_receipts_select ON public.seoul_receipts;
CREATE POLICY seoul_receipts_select ON public.seoul_receipts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id AND public.seoul_can_access(u.participant_id)));
DROP POLICY IF EXISTS seoul_receipts_write ON public.seoul_receipts;
CREATE POLICY seoul_receipts_write ON public.seoul_receipts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id
                    AND (public.seoul_is_staff_for(u.participant_id)
                         OR (public.seoul_is_self(u.participant_id) AND u.settlement_status = 'pending'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id
                    AND (public.seoul_is_staff_for(u.participant_id)
                         OR (public.seoul_is_self(u.participant_id) AND u.settlement_status = 'pending'))));

-- 모니터링–이용 연결 — 실무자 기록물
ALTER TABLE public.seoul_monitoring_usages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_monitoring_usages_select ON public.seoul_monitoring_usages;
CREATE POLICY seoul_monitoring_usages_select ON public.seoul_monitoring_usages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_monitoring_records m
                  WHERE m.id = monitoring_id AND public.seoul_can_access(m.participant_id)));
DROP POLICY IF EXISTS seoul_monitoring_usages_write ON public.seoul_monitoring_usages;
CREATE POLICY seoul_monitoring_usages_write ON public.seoul_monitoring_usages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_monitoring_records m
                  WHERE m.id = monitoring_id AND public.seoul_is_staff_for(m.participant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seoul_monitoring_records m
                  WHERE m.id = monitoring_id AND public.seoul_is_staff_for(m.participant_id)));


-- ── 그룹 D. 결정 기록 — 당사자는 읽기만, 쓰기는 관리자 ──────────────
--    ★ 읽기를 반드시 열어야 하는 이유: 자기 계획이 왜 부결됐는지 볼 수 없으면
--      이의신청을 할 수 없다. 권리구제의 전제는 이유를 아는 것이다.

ALTER TABLE public.seoul_selection_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_selection_decisions_select ON public.seoul_selection_decisions;
CREATE POLICY seoul_selection_decisions_select ON public.seoul_selection_decisions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_applications a
                  WHERE a.id = application_id AND public.seoul_can_access(a.participant_id)));
DROP POLICY IF EXISTS seoul_selection_decisions_write ON public.seoul_selection_decisions;
CREATE POLICY seoul_selection_decisions_write ON public.seoul_selection_decisions
  FOR ALL TO authenticated
  USING (public.seoul_is_admin()) WITH CHECK (public.seoul_is_admin());

ALTER TABLE public.seoul_plan_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_plan_reviews_select ON public.seoul_plan_reviews;
CREATE POLICY seoul_plan_reviews_select ON public.seoul_plan_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_utilization_plans p
                  WHERE p.id = plan_id AND public.seoul_can_access(p.participant_id)));
DROP POLICY IF EXISTS seoul_plan_reviews_write ON public.seoul_plan_reviews;
CREATE POLICY seoul_plan_reviews_write ON public.seoul_plan_reviews
  FOR ALL TO authenticated
  USING (public.seoul_is_admin()) WITH CHECK (public.seoul_is_admin());

ALTER TABLE public.seoul_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_settlements_select ON public.seoul_settlements;
CREATE POLICY seoul_settlements_select ON public.seoul_settlements
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_budget_allocations a
                  WHERE a.id = allocation_id AND public.seoul_can_access(a.participant_id)));
DROP POLICY IF EXISTS seoul_settlements_write ON public.seoul_settlements;
CREATE POLICY seoul_settlements_write ON public.seoul_settlements
  FOR ALL TO authenticated
  USING (public.seoul_is_admin()) WITH CHECK (public.seoul_is_admin());

-- 규칙 검증 결과 — 당사자는 자기 판정을 볼 수 있으나 뒤집을 수 없다
ALTER TABLE public.seoul_rule_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_rule_checks_select ON public.seoul_rule_checks;
CREATE POLICY seoul_rule_checks_select ON public.seoul_rule_checks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id AND public.seoul_can_access(u.participant_id)));
DROP POLICY IF EXISTS seoul_rule_checks_write ON public.seoul_rule_checks;
CREATE POLICY seoul_rule_checks_write ON public.seoul_rule_checks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id AND public.seoul_is_staff_for(u.participant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seoul_service_usages u
                  WHERE u.id = usage_id AND public.seoul_is_staff_for(u.participant_id)));
COMMENT ON TABLE public.seoul_rule_checks IS
  '당사자는 자기 지출의 검증 결과를 볼 수 있지만 판정을 바꿀 수는 없다 (읽기만).';


