-- =====================================================================
-- 10 · GOAL축 B — FK-ization (분류축 완성 + 사정 복합 무결성)
--      스펙: Plan&Source/ontology_db_reform_spec_W.md §4·§5
--      계약: Plan&Source/ontology/seoul/verify_classification_link.sql [B][D] green 타깃
--
-- [D] 5노드 단일 분류축(사정→목표→예산→지출→평가)을 같은 분류 FK 로 잇는다.
--     이미 존재: needs_assessment.domain_id(09) · requested_services.domain_id(03) · service_usages.domain_id(03)
--     이 파일 추가: budget_allocations.domain_id · service_usages.subdomain_id · settlements.domain_id
-- [B] 사정 복합 무결성: needs_assessment 의 (domain,subdomain)·(program,domain) 교차를 FK 로 방어.
--
-- ★ 백필 참고(스펙 §4 재조정): 자유텍스트 category(구 transactions/budget_line_items)는 컷오버로 소멸.
--   seoul 대상 테이블엔 자유텍스트 분류 컬럼이 없어(예산·정산=금액, 지출=domain_id 기보유) 1회 백필이
--   불필요하다. 신규 분류 컬럼은 nullable 로 두고 이후 서버액션이 채운다.
-- 재실행 가능(idempotent).
-- =====================================================================

-- ── §1. 복합 FK 타깃 UNIQUE ([B] 복합 FK 의 전제) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='seoul_service_domains_id_program_key') THEN
    ALTER TABLE public.seoul_service_domains
      ADD CONSTRAINT seoul_service_domains_id_program_key UNIQUE (id, program);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='seoul_service_subdomains_id_domain_key') THEN
    ALTER TABLE public.seoul_service_subdomains
      ADD CONSTRAINT seoul_service_subdomains_id_domain_key UNIQUE (id, domain_id);
  END IF;
END $$;

-- ── §2. [B] 사정 복합 무결성 — 분류 정합 강제 ──
--   (domain_id, program)   → domains(id, program)      : program 이 domain 소속과 일치해야 함(B2)
--   (subdomain_id, domain_id) → subdomains(id, domain_id): subdomain 이 그 domain 하위여야 함(B1)
--   subdomain_id NULL(서울형 flat)이면 MATCH SIMPLE 로 미검사 → flat 허용 유지.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='seoul_needs_assessment_domain_program_fk') THEN
    ALTER TABLE public.seoul_needs_assessment
      ADD CONSTRAINT seoul_needs_assessment_domain_program_fk
      FOREIGN KEY (domain_id, program) REFERENCES public.seoul_service_domains(id, program);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='seoul_needs_assessment_subdomain_domain_fk') THEN
    ALTER TABLE public.seoul_needs_assessment
      ADD CONSTRAINT seoul_needs_assessment_subdomain_domain_fk
      FOREIGN KEY (subdomain_id, domain_id) REFERENCES public.seoul_service_subdomains(id, domain_id);
  END IF;
END $$;

-- ── §3. [D] 분류축 컬럼 — 예산·지출(중분류)·평가 hop ──
-- [예산] seoul_budget_allocations.domain_id
ALTER TABLE public.seoul_budget_allocations
  ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES public.seoul_service_domains(id) ON DELETE SET NULL;
-- [지출·중분류] seoul_service_usages.subdomain_id  (domain_id 는 03 에서 기보유)
ALTER TABLE public.seoul_service_usages
  ADD COLUMN IF NOT EXISTS subdomain_id UUID REFERENCES public.seoul_service_subdomains(id) ON DELETE SET NULL;
-- [평가·정산] seoul_settlements.domain_id
ALTER TABLE public.seoul_settlements
  ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES public.seoul_service_domains(id) ON DELETE SET NULL;

-- 지출의 (subdomain_id, domain_id) 정합(둘 다 있을 때 subdomain 이 domain 하위) — 강건성
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='seoul_service_usages_subdomain_domain_fk') THEN
    ALTER TABLE public.seoul_service_usages
      ADD CONSTRAINT seoul_service_usages_subdomain_domain_fk
      FOREIGN KEY (subdomain_id, domain_id) REFERENCES public.seoul_service_subdomains(id, domain_id);
  END IF;
END $$;

-- ── §4. 인덱스 ──
CREATE INDEX IF NOT EXISTS idx_seoul_budget_allocations_domain ON public.seoul_budget_allocations(domain_id);
CREATE INDEX IF NOT EXISTS idx_seoul_service_usages_subdomain  ON public.seoul_service_usages(subdomain_id);
CREATE INDEX IF NOT EXISTS idx_seoul_settlements_domain        ON public.seoul_settlements(domain_id);

-- 주: 신규 컬럼은 모두 nullable. RLS 는 각 테이블 기존 정책(04)이 그대로 적용된다(컬럼 추가는 정책 불변).
