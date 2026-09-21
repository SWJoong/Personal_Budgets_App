-- =====================================================================
-- 19 · 계획 피드백 (plan_feedback)  —  축A/B 교차: 당사자가 이용계획에 가벼운 한마디  —  U(backend)
--
--      설계권위: docs/release/14 P2(④ 계획 공유+피드백, 사용자 확정 = (a) 가벼운 피드백)
--
-- 배경: 계획은 실무자가 작성하고 당사자는 열람·이의신청만 한다(읽기전용 원칙). 그 위에 '최소 침습'으로
--       당사자가 계획에 "확인했어요"(acknowledged) 또는 짧은 "궁금해요"(question)를 남기고 담당 실무자가
--       본다. 이의신청(공식 절차)과 별개인 가벼운 소통 채널이다.
-- 모델: participant_id = participants.id(당사자 레코드). plan_id = 어느 계획에 대한 피드백(nullable=계획 전반).
--       kind ∈ acknowledged|question. message = question 의 짧은 본문(acknowledged 는 비어도 됨).
-- RLS : 작성 = 당사자 본인만(INSERT WITH CHECK seoul_is_self — 남의 계획에 못 남김) ·
--       열람 = 본인 + 담당 실무자 + 관리자(SELECT USING seoul_can_access) — 실무자가 봐야 하므로 can_access.
--       UPDATE/DELETE 정책 없음 → append-only(정책 부재 = 기본 거부). 이의신청처럼 되돌리지 않는다.
-- 멱등: CREATE TABLE/INDEX IF NOT EXISTS · DROP POLICY IF EXISTS 후 재생성 → 재실행 가능.
-- 의존: participants(01) · seoul_utilization_plans(03) · seoul_is_self/seoul_can_access(01_core). → 03 이후.
-- =====================================================================

-- ── §1. 테이블 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seoul_plan_feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  plan_id        UUID REFERENCES public.seoul_utilization_plans(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('acknowledged', 'question')),
  message        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.seoul_plan_feedback IS
  '당사자가 이용계획에 남기는 가벼운 피드백(확인/궁금). 작성=당사자 본인, 열람=본인+담당실무자+관리자. append-only. 이의신청(공식)과 별개.';

CREATE INDEX IF NOT EXISTS idx_seoul_plan_feedback_participant
  ON public.seoul_plan_feedback(participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seoul_plan_feedback_plan
  ON public.seoul_plan_feedback(plan_id);

-- ── §2. RLS (작성=본인 / 열람=본인·담당실무자·관리자 · append-only) ────────
ALTER TABLE public.seoul_plan_feedback ENABLE ROW LEVEL SECURITY;

-- 열람: seoul_can_access = 본인(seoul_is_self) OR 담당(seoul_is_staff_for) OR 관리자.
DROP POLICY IF EXISTS seoul_plan_feedback_select ON public.seoul_plan_feedback;
CREATE POLICY seoul_plan_feedback_select ON public.seoul_plan_feedback
  FOR SELECT TO authenticated
  USING (public.seoul_can_access(participant_id));

-- 작성: 당사자 본인만(스탬프 위조·타인 계획 작성 차단).
DROP POLICY IF EXISTS seoul_plan_feedback_insert ON public.seoul_plan_feedback;
CREATE POLICY seoul_plan_feedback_insert ON public.seoul_plan_feedback
  FOR INSERT TO authenticated
  WITH CHECK (public.seoul_is_self(participant_id));

-- UPDATE·DELETE 정책 없음 → append-only(RLS 기본 거부).
