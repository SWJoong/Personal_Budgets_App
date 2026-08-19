-- 평가 발행 기능: published_at 컬럼 추가
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.evaluations.published_at IS
  '당사자에게 발행된 시각. NULL이면 미발행(초안) 상태.';
