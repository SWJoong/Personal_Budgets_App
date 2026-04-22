-- ============================================================
-- Migration 29: care_plans 및 evaluations 인덱스 추가
-- 목적: participant_id 기반 조회 성능 개선
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동 실행
-- 멱등성: IF NOT EXISTS 보장
-- ============================================================

-- care_plans: participant_id 단독 인덱스
-- (기존 UNIQUE(participant_id, plan_type, plan_year)와 별개로 단독 조회 가속)
CREATE INDEX IF NOT EXISTS idx_care_plans_participant_id
  ON public.care_plans (participant_id);

-- evaluations: participant_id + month 복합 인덱스 (최신 평가 우선 조회)
CREATE INDEX IF NOT EXISTS idx_evaluations_participant_month
  ON public.evaluations (participant_id, month DESC);

-- ────────────────────────────────────────────────────────────
-- 적용 확인 쿼리 (실행 후 아래 쿼리로 인덱스 생성 여부 확인)
-- ────────────────────────────────────────────────────────────
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_care_plans_participant_id',
  'idx_evaluations_participant_month'
)
ORDER BY tablename;
