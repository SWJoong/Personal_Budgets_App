-- =====================================================================
-- 13 · 사회 관계망 (seoul_network_entities)  —  Track B · B1  —  U(backend) 구현
--
--      설계권위: Plan&Source/goala_relationship_network_crud_W.md §1 (데이터모델·RLS)
--      계약:     Plan&Source/ontology/seoul/verify_network_entities.sql
--
-- 모델: "파생그래프 + 수동 큐레이션"(사용자 승인) — 실제 OWL reasoner 도입 아님.
--       FK-파생 그래프(05_seoul_graph)를 '후보'로 두고 실무자가 사회관계를 얹어 CRUD.
-- RLS : **실무자 전용(staff-only)** — 친밀도 1~4 평가·고립 신호 = 사정성 정보라
--       SELECT·INSERT·UPDATE·DELETE 전부 seoul_is_staff_for(participant_id).
--       (needs_assessment[09]는 seoul_can_access[본인+담당]지만 이 축은 더 보수적 — 사용자 결정.)
-- 멱등: CREATE TABLE/INDEX IF NOT EXISTS · DROP POLICY IF EXISTS 후 재생성 → 재실행 가능.
-- 의존: participants·profiles(01) · seoul_is_staff_for(01_core.sql, SECURITY DEFINER 헬퍼).
-- =====================================================================

-- ── §1. 테이블 (관계망 4분면 · pcp_ontology.rdf NetworkEntity 프로즈 스펙) ──
CREATE TABLE IF NOT EXISTS public.seoul_network_entities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id    UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  relation_category TEXT NOT NULL CHECK (relation_category IN ('family','friend','paid_support','community')),
  entity_name       TEXT NOT NULL,
  relation_type     TEXT,                                    -- 엄마·이웃·동료… 자유텍스트
  closeness         INT  CHECK (closeness BETWEEN 1 AND 4),  -- nullable; 1=최근접(동심원 거리)
  contact_frequency TEXT,                                    -- 주 1회 …
  last_contact_date DATE,                                    -- 고립위험 입력
  linked_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- 유급지원자↔직원 계정
  created_by        UUID REFERENCES public.profiles(id),     -- 기록자
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.seoul_network_entities IS
  '당사자 사회 관계망(가족/친구/유급지원/지역사회 4분면). 고립 신호 판독·수동 큐레이션용. RLS=실무자 전용.';

CREATE INDEX IF NOT EXISTS idx_seoul_network_entities_participant
  ON public.seoul_network_entities(participant_id);
CREATE INDEX IF NOT EXISTS idx_seoul_network_entities_participant_category
  ON public.seoul_network_entities(participant_id, relation_category);

-- ── §2. RLS (09 needs_assessment 블록 구조 미러 — 단 SELECT 도 staff-only) ──
-- 헬퍼: seoul_is_staff_for = seoul_is_admin() OR 담당(assigned_supporter_id). 본인 미포함.
ALTER TABLE public.seoul_network_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seoul_network_entities_select ON public.seoul_network_entities;
CREATE POLICY seoul_network_entities_select ON public.seoul_network_entities
  FOR SELECT TO authenticated USING (public.seoul_is_staff_for(participant_id));

DROP POLICY IF EXISTS seoul_network_entities_insert ON public.seoul_network_entities;
CREATE POLICY seoul_network_entities_insert ON public.seoul_network_entities
  FOR INSERT TO authenticated WITH CHECK (public.seoul_is_staff_for(participant_id));

DROP POLICY IF EXISTS seoul_network_entities_update ON public.seoul_network_entities;
CREATE POLICY seoul_network_entities_update ON public.seoul_network_entities
  FOR UPDATE TO authenticated
  USING (public.seoul_is_staff_for(participant_id))
  WITH CHECK (public.seoul_is_staff_for(participant_id));

DROP POLICY IF EXISTS seoul_network_entities_delete ON public.seoul_network_entities;
CREATE POLICY seoul_network_entities_delete ON public.seoul_network_entities
  FOR DELETE TO authenticated USING (public.seoul_is_staff_for(participant_id));
