-- ============================================================
-- Migration 24: support_goals — 연간 지원 목표 테이블
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동 실행
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. support_goals 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id    UUID NOT NULL,
  participant_id  UUID NOT NULL,
  order_index     SMALLINT NOT NULL CHECK (order_index BETWEEN 1 AND 10),

  support_area    TEXT NOT NULL,                -- 지원 영역 (자유 텍스트)
  is_to_goal      BOOLEAN NOT NULL DEFAULT FALSE,  -- 당사자에게 중요한 것 (To)
  is_for_whom     BOOLEAN NOT NULL DEFAULT FALSE,  -- 당사자를 위해 중요한 것 (For)
  needed_support  TEXT,
  outcome_goal    TEXT,
  strategy        TEXT,
  linked_services TEXT,

  eval_tool       TEXT,
  eval_target     TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  creator_id      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT support_goals_care_plan_id_fkey
    FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(id) ON DELETE CASCADE,
  CONSTRAINT support_goals_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
  CONSTRAINT support_goals_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,

  UNIQUE (care_plan_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_support_goals_care_plan
  ON public.support_goals (care_plan_id);
CREATE INDEX IF NOT EXISTS idx_support_goals_participant
  ON public.support_goals (participant_id);

-- ────────────────────────────────────────────────────────────
-- 2. RLS 정책
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.support_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_goals_select"
  ON public.support_goals FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "support_goals_insert_staff"
  ON public.support_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "support_goals_update_staff"
  ON public.support_goals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "support_goals_delete_staff"
  ON public.support_goals FOR DELETE
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
DROP TRIGGER IF EXISTS trg_support_goals_updated_at ON public.support_goals;
CREATE TRIGGER trg_support_goals_updated_at
  BEFORE UPDATE ON public.support_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
