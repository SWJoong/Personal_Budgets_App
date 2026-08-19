-- 기관 단위 시스템 설정 저장 테이블
CREATE TABLE IF NOT EXISTS public.system_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본값: PCP 4+1 양식
INSERT INTO public.system_settings (key, value)
VALUES ('eval_template', '{"active":"pcp"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 평가 테이블: 사용된 템플릿 ID + 유연한 데이터 컬럼 추가
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS evaluation_template TEXT NOT NULL DEFAULT 'pcp',
  ADD COLUMN IF NOT EXISTS template_data JSONB NULL;

COMMENT ON COLUMN public.evaluations.evaluation_template IS
  '작성 시 사용한 평가 양식 ID (pcp | seoul | mohw | custom)';
COMMENT ON COLUMN public.evaluations.template_data IS
  'PCP 외 양식의 필드 값 JSON. PCP 양식은 기존 tried/learned/pleased/concerned/next_step 컬럼 사용.';
