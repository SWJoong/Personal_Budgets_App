-- SIS-A (지원요구척도) 평가 결과 저장 테이블
CREATE TABLE IF NOT EXISTS public.sis_assessments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  assessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 원점수 (2A~2F)
  raw_2a INTEGER NOT NULL DEFAULT 0,
  raw_2b INTEGER NOT NULL DEFAULT 0,
  raw_2c INTEGER NOT NULL DEFAULT 0,
  raw_2d INTEGER NOT NULL DEFAULT 0,
  raw_2e INTEGER NOT NULL DEFAULT 0,
  raw_2f INTEGER NOT NULL DEFAULT 0,

  -- 표준점수 (변환 결과)
  std_2a INTEGER NOT NULL DEFAULT 0,
  std_2b INTEGER NOT NULL DEFAULT 0,
  std_2c INTEGER NOT NULL DEFAULT 0,
  std_2d INTEGER NOT NULL DEFAULT 0,
  std_2e INTEGER NOT NULL DEFAULT 0,
  std_2f INTEGER NOT NULL DEFAULT 0,

  -- 합산 및 지수
  total_std   INTEGER NOT NULL DEFAULT 0,   -- 표준점수 합계
  index_score TEXT    NOT NULL DEFAULT '',  -- 지원요구지수 (예: "100", "128-129")
  percentile  TEXT    NOT NULL DEFAULT '',  -- 백분위 (예: "50", ">99")

  creator_id  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.sis_assessments IS 'SIS-A(지원요구척도) 평가 결과. 원점수→표준점수 변환 및 지원요구지수 포함.';

-- RLS 활성화
ALTER TABLE public.sis_assessments ENABLE ROW LEVEL SECURITY;

-- 관리자·지원자: 전체 읽기·쓰기
CREATE POLICY "supporter_admin_sis_all" ON public.sis_assessments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 당사자: 본인 읽기 전용
CREATE POLICY "participant_sis_read" ON public.sis_assessments
  FOR SELECT
  USING (participant_id = auth.uid());
