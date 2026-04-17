-- participant_feedback 테이블: 당사자 화면 만족도 피드백 저장
CREATE TABLE IF NOT EXISTS public.participant_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  context text NOT NULL,        -- 피드백 수집 맥락 ('receipt_upload', 'onboarding', 'calendar')
  response text NOT NULL,       -- '😊', '😐', '😞' 등 이모지 응답
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.participant_feedback ENABLE ROW LEVEL SECURITY;

-- 당사자 본인만 INSERT 가능
CREATE POLICY "participant_feedback_insert"
  ON public.participant_feedback FOR INSERT
  TO authenticated
  WITH CHECK (participant_id = auth.uid());

-- 관리자/지원자는 모든 피드백 SELECT 가능, 당사자는 본인 것만
CREATE POLICY "participant_feedback_select"
  ON public.participant_feedback FOR SELECT
  TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 인덱스: 당사자별 조회 성능 향상
CREATE INDEX IF NOT EXISTS participant_feedback_participant_id_idx
  ON public.participant_feedback (participant_id, created_at DESC);
