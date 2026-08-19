-- 09_add_activity_photo_and_plan_details.sql
-- 1) transactions 테이블에 활동사진 URL 컬럼 추가
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS activity_image_url TEXT;

-- 2) plans 테이블에 5W1H 컨텍스트 컬럼 추가
--    { when: string, where: string, who: string, why: string, how: string }
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS details JSONB;
