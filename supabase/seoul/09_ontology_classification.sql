-- =====================================================================
-- 09 · 온톨로지 기반 분류축 (GOAL축 B)  —  U(backend) 구현
--      스펙: Plan&Source/ontology_db_reform_spec_W.md  (W 설계권위, #14)
--
-- 목적: 지원영역 "분류"를 참조테이블로 승격하고, 사정→목표→예산→지출→평가를
--       단일 분류축(FK)으로 연결한다. 재실행 가능(idempotent).
--
-- ★ 실제 seoul 스키마 반영(스펙 §4 재조정):
--   - 대분류 seoul_service_domains 는 03 에서 program 스코프(서울형6/복지부8)로 확장했다.
--   - 이 파일은 그 위에 (a) 중분류 seoul_service_subdomains, (b) 복지부 시드,
--     (c) 욕구사정 seoul_needs_assessment 를 얹는다(전부 additive).
--   - 스펙 §4 의 FK-ization(support_goals/budget_line_items/transactions → 컷오버로 소멸,
--     seoul_budget_allocations·seoul_service_usages 등으로 매핑)은 백필 설계가 필요하므로
--     W 확인 후 다음 단계에서 처리한다. (seoul_service_usages 등은 이미 domain_id FK 보유)
-- =====================================================================

-- ── §1. 중분류(subdomain) — 복지부 3단 구조. 서울형은 flat 이라 중분류 없이 domain 직접 참조 ──
CREATE TABLE IF NOT EXISTS public.seoul_service_subdomains (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id  UUID NOT NULL REFERENCES public.seoul_service_domains(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  label      TEXT NOT NULL,
  examples   TEXT[],                       -- 지원 예시(복지부 서식 §4) — 필요 시 확장
  sort_order INT  NOT NULL DEFAULT 0,
  UNIQUE (domain_id, code)
);
COMMENT ON TABLE public.seoul_service_subdomains IS
  '복지부 서식 §4 의 중분류. 서울형(flat)은 중분류 없이 seoul_service_domains 를 직접 참조한다.';

CREATE INDEX IF NOT EXISTS idx_seoul_service_subdomains_domain
  ON public.seoul_service_subdomains(domain_id);

-- ── §2. 복지부(program='mohw') 대분류 8종 시드 (서식 §4 원문) ──
INSERT INTO public.seoul_service_domains (program, code, label, sort_order) VALUES
  ('mohw','physical_health','신체적건강',      1),
  ('mohw','mental_health',  '정신적건강',      2),
  ('mohw','housing',        '주거',            3),
  ('mohw','daily_living',   '일상생활',        4),
  ('mohw','employment',     '일자리',          5),
  ('mohw','legal_rights',   '법률및권익보장',  6),
  ('mohw','culture_leisure','문화및여가',      7),
  ('mohw','voucher_flex',   '바우처유연화',    8)
ON CONFLICT (program, code) DO NOTHING;

-- ── §3. 복지부 중분류 시드 (대분류 code 로 domain_id 조인) ──
INSERT INTO public.seoul_service_subdomains (domain_id, code, label, sort_order)
SELECT d.id, v.code, v.label, v.sort_order
FROM (VALUES
  -- 신체적건강
  ('physical_health','health_promotion',     '건강증진',        1),
  ('physical_health','rehabilitation',       '재활',            2),
  ('physical_health','assistive_devices',    '장애인보조기기',  3),
  ('physical_health','medical_supplies',     '의료용소모품',    4),
  ('physical_health','other_health_products','기타건강제품',    5),
  -- 정신적건강
  ('mental_health','mental_health_promotion','정신건강증진',    1),
  ('mental_health','diagnosis',              '검사진단',        2),
  ('mental_health','counseling_therapy',     '상담치료',        3),
  ('mental_health','other',                  '기타',            4),
  -- 주거
  ('housing','home_modification',            '주택개조',        1),
  ('housing','housing_support_service',      '주거지원서비스',  2),
  ('housing','housing_support_goods',        '주거지원물품',    3),
  -- 일상생활
  ('daily_living','daily_care',              '일상생활유지돌봄',1),
  ('daily_living','daily_goods',             '일상생활용품',    2),
  ('daily_living','mobility_support',        '이동지원',        3),
  ('daily_living','other',                   '기타',            4),
  -- 일자리
  ('employment','job_counseling',            '직업상담연계',    1),
  ('employment','vocational_training',       '직업교육훈련',    2),
  ('employment','startup_support',           '창업지원',        3),
  ('employment','goods',                     '물품',            4),
  ('employment','other',                     '기타',            5),
  -- 법률및권익보장
  ('legal_rights','legal_rights',            '법률및권익보장',  1),
  -- 문화및여가
  ('culture_leisure','culture_leisure_activity','문화여가활동', 1),
  ('culture_leisure','lifelong_education',   '평생교육',        2),
  ('culture_leisure','other',                '기타',            3),
  -- 바우처유연화
  ('voucher_flex','activity_support',        '활동지원',        1),
  ('voucher_flex','dev_disability_day',      '발달장애인주간활동',2)
) AS v(domain_code, code, label, sort_order)
JOIN public.seoul_service_domains d ON d.program = 'mohw' AND d.code = v.domain_code
ON CONFLICT (domain_id, code) DO NOTHING;

-- ── §4. 욕구사정 seoul_needs_assessment (복지부 서식 §4: 대/중분류별 제한점·욕구) ──
CREATE TABLE IF NOT EXISTS public.seoul_needs_assessment (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  program        TEXT NOT NULL DEFAULT 'seoul' CHECK (program IN ('seoul','mohw')),
  domain_id      UUID NOT NULL REFERENCES public.seoul_service_domains(id) ON DELETE RESTRICT,
  subdomain_id   UUID REFERENCES public.seoul_service_subdomains(id) ON DELETE SET NULL,  -- 서울형 flat 이면 NULL
  support_example TEXT,     -- 지원 예시
  limitation     TEXT,      -- 제한점
  need_hope      TEXT,      -- 욕구와 희망
  assessed_by    UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.seoul_needs_assessment IS
  '지원영역 욕구사정. 사정(domain/subdomain) → 목표 → 예산 → 지출 → 평가를 동일 분류축으로 잇는 시작점.';

CREATE INDEX IF NOT EXISTS idx_seoul_needs_assessment_participant
  ON public.seoul_needs_assessment(participant_id);
CREATE INDEX IF NOT EXISTS idx_seoul_needs_assessment_domain
  ON public.seoul_needs_assessment(domain_id);

-- ── §5. RLS (04_seoul_rls.sql 패턴 미러 — 헬퍼: seoul_is_admin/seoul_can_access/seoul_is_staff_for) ──
-- 중분류: 참조테이블 → 전원 읽기, 관리자만 쓰기
ALTER TABLE public.seoul_service_subdomains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_service_subdomains_read ON public.seoul_service_subdomains;
CREATE POLICY seoul_service_subdomains_read ON public.seoul_service_subdomains
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS seoul_service_subdomains_admin_write ON public.seoul_service_subdomains;
CREATE POLICY seoul_service_subdomains_admin_write ON public.seoul_service_subdomains
  FOR ALL TO authenticated USING (public.seoul_is_admin()) WITH CHECK (public.seoul_is_admin());

-- 욕구사정: 당사자 스코프 → 본인·담당 실무자 읽기, 담당 실무자 쓰기·삭제(seoul_is_staff_for = 담당 OR 관리자)
ALTER TABLE public.seoul_needs_assessment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seoul_needs_assessment_select ON public.seoul_needs_assessment;
CREATE POLICY seoul_needs_assessment_select ON public.seoul_needs_assessment
  FOR SELECT TO authenticated USING (public.seoul_can_access(participant_id));
DROP POLICY IF EXISTS seoul_needs_assessment_insert ON public.seoul_needs_assessment;
CREATE POLICY seoul_needs_assessment_insert ON public.seoul_needs_assessment
  FOR INSERT TO authenticated WITH CHECK (public.seoul_is_staff_for(participant_id));
DROP POLICY IF EXISTS seoul_needs_assessment_update ON public.seoul_needs_assessment;
CREATE POLICY seoul_needs_assessment_update ON public.seoul_needs_assessment
  FOR UPDATE TO authenticated
  USING (public.seoul_is_staff_for(participant_id))
  WITH CHECK (public.seoul_is_staff_for(participant_id));
-- 삭제 = 담당 실무자 허용(관리자 포함). W #24 결정(2026-08-19): 작성 담당자 본인도 삭제 가능해야
--   UX 가 맞고 insert/update 와 일관. seoul_is_staff_for = seoul_is_admin() OR 담당 → 비담당만 차단.
--   계약: Plan&Source/ontology/seoul/verify_needs_assessment_rls.sql [3].
DROP POLICY IF EXISTS seoul_needs_assessment_delete ON public.seoul_needs_assessment;
CREATE POLICY seoul_needs_assessment_delete ON public.seoul_needs_assessment
  FOR DELETE TO authenticated USING (public.seoul_is_staff_for(participant_id));
