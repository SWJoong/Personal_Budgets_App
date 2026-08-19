-- Migration 16: Add location fields to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS place_name TEXT,
  ADD COLUMN IF NOT EXISTS place_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS place_lng NUMERIC(10, 7);

COMMENT ON COLUMN public.transactions.place_name IS '결제 장소명 (카카오 로컬 검색 결과)';
COMMENT ON COLUMN public.transactions.place_lat IS '위도 (카카오 로컬 검색 결과)';
COMMENT ON COLUMN public.transactions.place_lng IS '경도 (카카오 로컬 검색 결과)';
