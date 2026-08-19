-- ============================================================
-- Migration 26: budget_line_items — 예산 세목 테이블
-- 전제: Migration 24 (support_goals) 먼저 실행
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동 실행
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. budget_line_items 테이블
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_line_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id      UUID NOT NULL,
  funding_source_id UUID,
  support_goal_id   UUID,

  category          TEXT NOT NULL,
  item_name         TEXT NOT NULL,

  unit_cost         NUMERIC NOT NULL DEFAULT 0,
  quantity          NUMERIC NOT NULL DEFAULT 1,
  unit_label        TEXT,
  calculation_note  TEXT,
  -- GENERATED ALWAYS: Supabase PG15+ 지원 확인
  total_amount      NUMERIC GENERATED ALWAYS AS (unit_cost * quantity) STORED,

  order_index       SMALLINT NOT NULL DEFAULT 1,
  creator_id        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT budget_line_items_care_plan_id_fkey
    FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(id) ON DELETE CASCADE,
  CONSTRAINT budget_line_items_funding_source_id_fkey
    FOREIGN KEY (funding_source_id) REFERENCES public.funding_sources(id) ON DELETE SET NULL,
  CONSTRAINT budget_line_items_support_goal_id_fkey
    FOREIGN KEY (support_goal_id) REFERENCES public.support_goals(id) ON DELETE RESTRICT,
  CONSTRAINT budget_line_items_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_budget_line_items_care_plan
  ON public.budget_line_items (care_plan_id);
CREATE INDEX IF NOT EXISTS idx_budget_line_items_support_goal
  ON public.budget_line_items (support_goal_id);
CREATE INDEX IF NOT EXISTS idx_budget_line_items_funding_source
  ON public.budget_line_items (funding_source_id);

-- ────────────────────────────────────────────────────────────
-- 2. RLS 정책
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_line_items_select"
  ON public.budget_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_plans cp
      WHERE cp.id = budget_line_items.care_plan_id
        AND (
          cp.participant_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'supporter')
          )
        )
    )
  );

CREATE POLICY "budget_line_items_insert_staff"
  ON public.budget_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "budget_line_items_update_staff"
  ON public.budget_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "budget_line_items_delete_staff"
  ON public.budget_line_items FOR DELETE
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
DROP TRIGGER IF EXISTS trg_budget_line_items_updated_at ON public.budget_line_items;
CREATE TRIGGER trg_budget_line_items_updated_at
  BEFORE UPDATE ON public.budget_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
