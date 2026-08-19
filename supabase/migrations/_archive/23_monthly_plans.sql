-- ============================================================
-- Migration 23: 월별 계획(monthly_plans) 테이블 + transactions.monthly_plan_id
-- 대상: monthly_plans (신규), transactions (컬럼 추가)
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동 실행
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. monthly_plans 테이블 (월별 계획 1~6개 per 당사자)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monthly_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id     UUID NOT NULL,
  month              DATE NOT NULL,                  -- 예: 2026-04-01
  order_index        SMALLINT NOT NULL CHECK (order_index BETWEEN 1 AND 6),
  title              TEXT NOT NULL,                  -- "카페 4회 가기"
  description        TEXT,                           -- 상세 내용
  funding_source_id  UUID,
  planned_budget     NUMERIC NOT NULL DEFAULT 0,
  target_count       SMALLINT,                       -- 목표 횟수 (nullable)
  scheduled_dates    DATE[] DEFAULT '{}',            -- 시행 예정일들 (nullable)
  creator_id         UUID,
  created_at         TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at         TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT monthly_plans_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
  CONSTRAINT monthly_plans_funding_source_id_fkey
    FOREIGN KEY (funding_source_id) REFERENCES public.funding_sources(id) ON DELETE SET NULL,
  CONSTRAINT monthly_plans_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE SET NULL,

  UNIQUE (participant_id, month, order_index)
);

CREATE INDEX IF NOT EXISTS idx_monthly_plans_participant_month
  ON public.monthly_plans (participant_id, month);

-- ────────────────────────────────────────────────────────────
-- 2. transactions 에 monthly_plan_id FK 추가
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS monthly_plan_id UUID;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_monthly_plan_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_monthly_plan_id_fkey
  FOREIGN KEY (monthly_plan_id)
  REFERENCES public.monthly_plans(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_monthly_plan_id
  ON public.transactions (monthly_plan_id);

-- ────────────────────────────────────────────────────────────
-- 3. RLS 정책
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.monthly_plans ENABLE ROW LEVEL SECURITY;

-- 당사자 본인 조회 + 실무자/관리자 전체 조회
CREATE POLICY "monthly_plans_select"
  ON public.monthly_plans FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 실무자/관리자만 생성
CREATE POLICY "monthly_plans_insert_staff"
  ON public.monthly_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 실무자/관리자만 수정
CREATE POLICY "monthly_plans_update_staff"
  ON public.monthly_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 실무자/관리자만 삭제
CREATE POLICY "monthly_plans_delete_staff"
  ON public.monthly_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. updated_at 자동 갱신 트리거 (이미 있으면 스킵)
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_monthly_plans_updated_at ON public.monthly_plans;
CREATE TRIGGER trg_monthly_plans_updated_at
  BEFORE UPDATE ON public.monthly_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
