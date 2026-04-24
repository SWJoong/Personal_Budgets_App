-- ============================================================
-- Migration 30: easy_read 컬럼 추가
-- monthly_plans + support_goals 에 easy_description, easy_image_url 추가
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동으로 실행하세요.
-- ============================================================

ALTER TABLE public.monthly_plans
  ADD COLUMN IF NOT EXISTS easy_description TEXT,
  ADD COLUMN IF NOT EXISTS easy_image_url   TEXT;

ALTER TABLE public.support_goals
  ADD COLUMN IF NOT EXISTS easy_description TEXT,
  ADD COLUMN IF NOT EXISTS easy_image_url   TEXT;

-- RLS 추가 불필요: 기존 테이블 정책이 신규 컬럼에 자동 적용됩니다.
