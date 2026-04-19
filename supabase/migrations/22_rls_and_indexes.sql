-- ============================================================
-- Migration 22: RLS 정책 추가 + 성능 인덱스
-- 대상 테이블: transactions, plans, evaluations, file_links
-- 실행: Supabase 대시보드 > SQL Editor 에서 수동 실행
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RLS 활성화
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links    ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 2. transactions RLS 정책
-- ────────────────────────────────────────────────────────────

-- 당사자: 본인 거래만 조회
CREATE POLICY "transactions_select_participant"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 당사자: 본인 거래 INSERT
CREATE POLICY "transactions_insert_participant"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 관리자/지원자만 UPDATE (영수증 승인/거부)
CREATE POLICY "transactions_update_supporter"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 관리자만 DELETE
CREATE POLICY "transactions_delete_admin"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. plans RLS 정책
-- ────────────────────────────────────────────────────────────

CREATE POLICY "plans_select"
  ON public.plans FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "plans_insert"
  ON public.plans FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "plans_update"
  ON public.plans FOR UPDATE
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "plans_delete_admin"
  ON public.plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 4. evaluations RLS 정책
-- ────────────────────────────────────────────────────────────

-- published_at이 있는 평가만 당사자에게 노출
CREATE POLICY "evaluations_select"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    (participant_id = auth.uid() AND published_at IS NOT NULL)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "evaluations_insert_supporter"
  ON public.evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "evaluations_update_supporter"
  ON public.evaluations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "evaluations_delete_admin"
  ON public.evaluations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 5. file_links RLS 정책
-- ────────────────────────────────────────────────────────────

CREATE POLICY "file_links_select"
  ON public.file_links FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "file_links_insert_supporter"
  ON public.file_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

CREATE POLICY "file_links_delete_admin"
  ON public.file_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. 성능 인덱스
-- ────────────────────────────────────────────────────────────

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_participant_id
  ON public.transactions (participant_id);

CREATE INDEX IF NOT EXISTS idx_transactions_participant_date
  ON public.transactions (participant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON public.transactions (status);

-- plans
CREATE INDEX IF NOT EXISTS idx_plans_participant_id
  ON public.plans (participant_id);

CREATE INDEX IF NOT EXISTS idx_plans_date
  ON public.plans (date);

-- funding_sources
CREATE INDEX IF NOT EXISTS idx_funding_sources_participant_id
  ON public.funding_sources (participant_id);

-- evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_participant_id
  ON public.evaluations (participant_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_month
  ON public.evaluations (month);

-- file_links
CREATE INDEX IF NOT EXISTS idx_file_links_participant_id
  ON public.file_links (participant_id);
