-- 개인예산 이용계획서 저장 테이블 (보건복지부형·서울형)
-- 개인정보(성명/주소/계좌 등 식별정보)는 제외하고 실무 계획 내용만 저장
CREATE TABLE IF NOT EXISTS public.care_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  plan_type      TEXT NOT NULL,           -- 'mohw_plan' | 'seoul_plan'
  plan_year      INTEGER NOT NULL,        -- 해당 연도
  content        JSONB NOT NULL DEFAULT '{}'::jsonb,
  creator_id     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT care_plans_unique_per_year UNIQUE (participant_id, plan_type, plan_year)
);

COMMENT ON TABLE public.care_plans IS '보건복지부형·서울형 개인예산 이용계획서 (초기 사정 및 지원 계획)';
COMMENT ON COLUMN public.care_plans.plan_type IS 'mohw_plan=보건복지부형, seoul_plan=서울형';
COMMENT ON COLUMN public.care_plans.content IS '이용계획서 내용 JSONB. 개인정보(성명/주소 등)는 저장하지 않음.';

-- RLS 활성화
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;

-- 관리자·지원자: 전체 읽기·쓰기
CREATE POLICY "supporter_admin_care_plans_all" ON public.care_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supporter')
    )
  );

-- 당사자: 본인 데이터 읽기 전용
CREATE POLICY "participant_care_plans_read" ON public.care_plans
  FOR SELECT
  USING (
    participant_id = auth.uid()
  );
