-- ============================================================
-- Migration 27: monthly_plans 확장 — support_goal 연결
-- 전제: Migration 24 (support_goals) 먼저 실행
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동 실행
-- ============================================================

ALTER TABLE public.monthly_plans
  ADD COLUMN IF NOT EXISTS support_goal_id UUID;

ALTER TABLE public.monthly_plans
  DROP CONSTRAINT IF EXISTS monthly_plans_support_goal_id_fkey;

ALTER TABLE public.monthly_plans
  ADD CONSTRAINT monthly_plans_support_goal_id_fkey
  FOREIGN KEY (support_goal_id)
  REFERENCES public.support_goals(id)
  ON DELETE SET NULL;

ALTER TABLE public.monthly_plans
  ADD COLUMN IF NOT EXISTS activity_photos TEXT[] DEFAULT '{}';

ALTER TABLE public.monthly_plans
  ADD COLUMN IF NOT EXISTS staff_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_monthly_plans_support_goal
  ON public.monthly_plans (support_goal_id);
