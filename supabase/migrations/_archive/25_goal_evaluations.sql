-- ============================================================
-- Migration 25: goal_evaluations — 목표별 평가 테이블
-- 전제: Migration 24 (support_goals) 먼저 실행
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동 실행
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. goal_evaluations 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goal_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID NOT NULL,
  support_goal_id UUID NOT NULL,

  -- 4+1 평가 프레임워크
  tried           TEXT,
  achievement     TEXT CHECK (achievement IN ('achieved', 'in_progress', 'not_achieved')),
  learned         TEXT,
  satisfied       TEXT,
  dissatisfied    TEXT,
  next_plan       TEXT,

  -- 정량 메트릭 (선택)
  target_value    NUMERIC,
  actual_value    NUMERIC,

  creator_id      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT goal_evaluations_evaluation_id_fkey
    FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id) ON DELETE CASCADE,
  CONSTRAINT goal_evaluations_support_goal_id_fkey
    FOREIGN KEY (support_goal_id) REFERENCES public.support_goals(id) ON DELETE CASCADE,
  CONSTRAINT goal_evaluations_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,

  UNIQUE (evaluation_id, support_goal_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_evaluations_evaluation
  ON public.goal_evaluations (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_goal_evaluations_support_goal
  ON public.goal_evaluations (support_goal_id);

-- ────────────────────────────────────────────────────────────
-- 2. RLS 정책
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.goal_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_evaluations_select"
  ON public.goal_evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      JOIN public.participants p ON p.id = e.participant_id
      WHERE e.id = goal_evaluations.evaluation_id
        AND (
          p.id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'supporter')
          )
        )
    )
  );

CREATE POLICY "goal_evaluations_insert_staff"
  ON public.goal_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "goal_evaluations_update_staff"
  ON public.goal_evaluations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "goal_evaluations_delete_staff"
  ON public.goal_evaluations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. updated_at 트리거
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_goal_evaluations_updated_at ON public.goal_evaluations;
CREATE TRIGGER trg_goal_evaluations_updated_at
  BEFORE UPDATE ON public.goal_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
