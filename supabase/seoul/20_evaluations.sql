-- =====================================================================
-- 20 · 월별 평가 (evaluations)  —  축B: 실무자 행정(평가 양식)  —  U(backend)
--
--      설계권위: 사용자 결정 2026-09-25 (계획·평가 개선 — "레거시 검토 후 신규 테이블 여부 결정")
--        · 당사자 직접 평가 = 실무자가 대신 기록(대필)
--        · 계획 이행 정도   = 계획 항목(신청 서비스)별
--
-- 배경: 서울형 스키마에는 정형 평가가 없었다(03_seoul_schema §11 모니터링 주석). 레거시(월별 4+1
--       evaluations · 항목별 goal_evaluations)는 036a8d1 에서 제거되어 아카이브(미실행)로만 남아 있어
--       '부활'이 아니라 서울형 모델에 맞춘 '신설'이다. 레거시의 폼 개념(월별 서술 + 항목별 달성)만 계승.
--
-- 모델:
--   seoul_evaluations           — 당사자 × 월(period 'YYYY-MM') 1건.
--                                 budget_usage_note(월별 예산 사용 평가 서술) · participant_opinion(당사자
--                                 의견 — 실무자 대필) · overall_note(종합 소견).
--                                 ★예산 수치(쓴 돈·정산)는 저장하지 않는다 — 화면에서 seoul_service_usages /
--                                   seoul_settlements 로 계산해 보여준다(원장이 정본, 사본 불일치 방지).
--   seoul_plan_item_evaluations — 평가 × 계획 항목(seoul_requested_services) 1건. 이행 정도 4단계 + 메모.
--
-- RLS:
--   열람 = seoul_can_access(참여자) — 본인·담당 실무자·관리자. 당사자도 자기 평가를 볼 수 있다.
--   쓰기 = seoul_is_staff_for(참여자) — 담당 실무자·관리자만. 당사자 본인 작성 없음(대필 결정).
--   항목 평가는 부모 평가의 참여자로 판정한다.
-- 무결성(역할 무관 트리거): 항목의 신청 서비스가 '같은 당사자'의 계획 소속이어야 한다 — 남의 계획
--   항목에 평가를 붙이는 교차 오염을 DB 레벨에서 차단(service role·직접 SQL 포함). 평가의 당사자 변경도
--   금지. 평가가 달린 신청 서비스의 계획 이동·그 계획의 당사자 변경도 금지(부모 쪽 우회로 차단).
--   authored_by 는 본인 id 만(RLS WITH CHECK).
-- 기록 보호: 평가가 달린 계획 항목은 삭제 불가(FK RESTRICT) — 과거 평가가 조용히 사라지지 않게.
-- 목록용 뷰: v_seoul_latest_evaluation(당사자별 최신 평가 달, security_invoker).
-- 멱등: CREATE TABLE/INDEX IF NOT EXISTS · CREATE OR REPLACE FUNCTION · DROP POLICY/TRIGGER IF EXISTS 후 재생성.
-- 의존: participants·profiles·set_updated_at·seoul_can_access·seoul_is_staff_for(01) ·
--       seoul_requested_services·seoul_utilization_plans(03). → 03 이후.
-- =====================================================================

-- ── §1. 월별 평가 (헤더) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seoul_evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id      UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  period              TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  budget_usage_note   TEXT,   -- 월별 예산 사용 평가(서술). 수치는 원장에서 계산해 보여준다.
  participant_opinion TEXT,   -- 당사자 직접 평가 — 실무자가 당사자의 말을 대신 기록(대필).
  overall_note        TEXT,   -- 종합 소견
  authored_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id, period)   -- 당사자·월 1건 (upsert 키, 인덱스 겸용)
);
COMMENT ON TABLE public.seoul_evaluations IS
  '당사자별 월별 평가(예산 사용 서술·당사자 의견 대필·종합 소견). 열람=본인·담당·관리자, 쓰기=담당·관리자. 수치는 원장에서 계산.';

DROP TRIGGER IF EXISTS trg_seoul_evaluations_updated_at ON public.seoul_evaluations;
CREATE TRIGGER trg_seoul_evaluations_updated_at
  BEFORE UPDATE ON public.seoul_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ★평가의 당사자는 바꿀 수 없다(역할 무관). 바꾸면 이미 붙은 항목 평가가 남의 계획 항목을 가리킨 채 남는다
--   (항목 트리거는 부모 이동을 보지 못함). 두 당사자를 모두 담당하는 실무자·관리자·service role 도 차단.
CREATE OR REPLACE FUNCTION public.seoul_lock_evaluation_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.participant_id IS DISTINCT FROM OLD.participant_id THEN
    RAISE EXCEPTION '평가의 당사자는 바꿀 수 없습니다(평가 %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seoul_lock_evaluation_participant ON public.seoul_evaluations;
CREATE TRIGGER trg_seoul_lock_evaluation_participant
  BEFORE UPDATE ON public.seoul_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.seoul_lock_evaluation_participant();

-- ── §2. 계획 항목별 이행 정도 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seoul_plan_item_evaluations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id        UUID NOT NULL REFERENCES public.seoul_evaluations(id) ON DELETE CASCADE,
  -- RESTRICT: 평가가 작성된 계획 항목은 지울 수 없다 — CASCADE 면 deleteRequestedService 가 과거 평가를
  --   조용히 지운다(평가 기록 보호). 앱은 23503 을 "이미 월별 평가가 작성된 항목" 으로 안내한다.
  requested_service_id UUID NOT NULL REFERENCES public.seoul_requested_services(id) ON DELETE RESTRICT,
  achievement          TEXT NOT NULL
                         CHECK (achievement IN ('not_achieved', 'partial', 'achieved', 'exceeded')),
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evaluation_id, requested_service_id)   -- 평가·항목 1건 (upsert 키)
);
COMMENT ON TABLE public.seoul_plan_item_evaluations IS
  '월별 평가의 계획 항목(신청 서비스)별 이행 정도(미이행/부분/이행/초과) + 메모. 권한은 부모 평가의 참여자로 판정.';
CREATE INDEX IF NOT EXISTS idx_seoul_plan_item_eval_service
  ON public.seoul_plan_item_evaluations(requested_service_id);

DROP TRIGGER IF EXISTS trg_seoul_plan_item_eval_updated_at ON public.seoul_plan_item_evaluations;
CREATE TRIGGER trg_seoul_plan_item_eval_updated_at
  BEFORE UPDATE ON public.seoul_plan_item_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ★교차 오염 방지 — 항목(신청 서비스)의 계획 소유자 = 평가의 당사자여야 한다. 역할 무관 차단.
--   SECURITY INVOKER(활동사진 경로 트리거와 동일): 조회가 호출자 RLS 를 따르므로, 평가·계획을 볼 수 없는
--   호출자(미배정 실무자 등)는 NULL 로 판정되어 fail-closed 차단된다. 정당한 작성자(담당·관리자·service
--   role)는 해당 행을 항상 볼 수 있어 오탐이 없다. (verify_evaluations I2·I3·I4·I5)
CREATE OR REPLACE FUNCTION public.seoul_check_plan_item_eval_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_eval_participant UUID;
  v_item_participant UUID;
BEGIN
  SELECT e.participant_id INTO v_eval_participant
    FROM public.seoul_evaluations e WHERE e.id = NEW.evaluation_id;
  SELECT p.participant_id INTO v_item_participant
    FROM public.seoul_requested_services rs
    JOIN public.seoul_utilization_plans p ON p.id = rs.plan_id
   WHERE rs.id = NEW.requested_service_id;
  IF v_eval_participant IS NULL OR v_item_participant IS NULL
     OR v_eval_participant <> v_item_participant THEN
    RAISE EXCEPTION '계획 항목(%)이 이 평가의 당사자(%) 계획에 속하지 않습니다',
      NEW.requested_service_id, v_eval_participant;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seoul_check_plan_item_eval_owner ON public.seoul_plan_item_evaluations;
CREATE TRIGGER trg_seoul_check_plan_item_eval_owner
  BEFORE INSERT OR UPDATE ON public.seoul_plan_item_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.seoul_check_plan_item_eval_owner();

-- ★부모 쪽 이동 잠금 — 위 트리거는 항목 행의 INSERT/UPDATE 때만 돈다. 그래서 평가가 달린 신청 서비스를
--   다른 계획으로 옮기거나(plan_id), 그 계획의 당사자를 바꾸면(participant_id) 항목이 남의 계획을 가리키는
--   교차 오염이 생긴다(평가 쪽 잠금 seoul_lock_evaluation_participant 의 반대편 경로). 평가가 달린 경우에만
--   막는다(평가 없는 항목·계획은 기존 동작 그대로). 앱에는 이 두 값을 바꾸는 흐름이 없다(upsert 는
--   (plan_id, priority) 가 충돌 키라 plan_id 불변 · updateUtilizationPlan 은 기간·작성방식만 수정).
--   ★SECURITY DEFINER: '평가가 달렸는가'는 호출자 RLS 와 무관하게 판정해야 한다(안 보이면 통과하는
--   fail-open 방지). 트리거 함수라 직접 호출은 불가.
CREATE OR REPLACE FUNCTION public.seoul_guard_evaluated_service_move()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     AND EXISTS (SELECT 1 FROM public.seoul_plan_item_evaluations WHERE requested_service_id = OLD.id) THEN
    RAISE EXCEPTION '월별 평가가 작성된 계획 항목은 다른 계획으로 옮길 수 없습니다';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seoul_guard_evaluated_service_move ON public.seoul_requested_services;
CREATE TRIGGER trg_seoul_guard_evaluated_service_move
  BEFORE UPDATE OF plan_id ON public.seoul_requested_services
  FOR EACH ROW EXECUTE FUNCTION public.seoul_guard_evaluated_service_move();

CREATE OR REPLACE FUNCTION public.seoul_guard_evaluated_plan_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.participant_id IS DISTINCT FROM OLD.participant_id
     AND EXISTS (SELECT 1
                   FROM public.seoul_plan_item_evaluations ie
                   JOIN public.seoul_requested_services rs ON rs.id = ie.requested_service_id
                  WHERE rs.plan_id = OLD.id) THEN
    RAISE EXCEPTION '월별 평가가 작성된 계획은 다른 당사자로 옮길 수 없습니다';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seoul_guard_evaluated_plan_owner ON public.seoul_utilization_plans;
CREATE TRIGGER trg_seoul_guard_evaluated_plan_owner
  BEFORE UPDATE OF participant_id ON public.seoul_utilization_plans
  FOR EACH ROW EXECUTE FUNCTION public.seoul_guard_evaluated_plan_owner();

-- ── §3. RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.seoul_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seoul_plan_item_evaluations ENABLE ROW LEVEL SECURITY;

-- 평가: 열람 = 본인·담당·관리자 / 쓰기(insert·update·delete) = 담당·관리자.
DROP POLICY IF EXISTS seoul_evaluations_select ON public.seoul_evaluations;
CREATE POLICY seoul_evaluations_select ON public.seoul_evaluations
  FOR SELECT TO authenticated
  USING (public.seoul_can_access(participant_id));

-- WITH CHECK 의 authored_by: '누가 썼나'는 슈퍼비전(축C) 근거라 본인 id(또는 비움)만 허용 — 다른 실무자로 위장 차단.
DROP POLICY IF EXISTS seoul_evaluations_write ON public.seoul_evaluations;
CREATE POLICY seoul_evaluations_write ON public.seoul_evaluations
  FOR ALL TO authenticated
  USING (public.seoul_is_staff_for(participant_id))
  WITH CHECK (public.seoul_is_staff_for(participant_id)
              AND (authored_by IS NULL OR authored_by = auth.uid()));

-- 항목 평가: 부모 평가의 참여자로 판정.
DROP POLICY IF EXISTS seoul_plan_item_eval_select ON public.seoul_plan_item_evaluations;
CREATE POLICY seoul_plan_item_eval_select ON public.seoul_plan_item_evaluations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_evaluations e
                  WHERE e.id = evaluation_id AND public.seoul_can_access(e.participant_id)));

DROP POLICY IF EXISTS seoul_plan_item_eval_write ON public.seoul_plan_item_evaluations;
CREATE POLICY seoul_plan_item_eval_write ON public.seoul_plan_item_evaluations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seoul_evaluations e
                  WHERE e.id = evaluation_id AND public.seoul_is_staff_for(e.participant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seoul_evaluations e
                  WHERE e.id = evaluation_id AND public.seoul_is_staff_for(e.participant_id)));

-- ── §4. 당사자별 최신 평가 달 (목록 표시용) ──────────────────────────────
-- 평가 목록 화면이 전 평가 행을 읽으면 PostgREST max_rows(기본 1000)에 잘려 오래된 당사자가 '평가 없음'으로
-- 잘못 보인다. 당사자당 1행만 돌려주는 뷰로 대체. security_invoker = true → 조회자 RLS(seoul_can_access)가
-- 그대로 적용된다(v_seoul_monthly_usage 등 기존 뷰와 같은 방식).
CREATE OR REPLACE VIEW public.v_seoul_latest_evaluation
  WITH (security_invoker = true) AS
SELECT DISTINCT ON (e.participant_id)
  e.participant_id,
  e.period,
  e.updated_at
FROM public.seoul_evaluations e
ORDER BY e.participant_id, e.period DESC;
COMMENT ON VIEW public.v_seoul_latest_evaluation IS
  '당사자별 가장 최근 평가 달. security_invoker — 조회자 RLS 적용. /supporter/evaluations 목록 요약용.';
