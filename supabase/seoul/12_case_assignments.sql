-- =====================================================================
-- 12 · 담당자 배정 스코핑 (B4)  —  U(backend) 구현
--      스펙: Plan&Source/goala_privacy_deid_assignment_W.md §2 (W 설계권위)
--
-- 목적: 실무자(supporter)의 당사자 열람을 "배정된 당사자"로 좁히기 위한 기반.
--   기존 participants.assigned_supporter_id 는 1:1 단일 FK 라 한 당사자에 여러 담당자를
--   표현할 수 없다. 이 파일은 그 위에 다대다 배정 junction 과 판정 헬퍼 is_assigned() 를
--   얹는다(additive·멱등). 재실행 가능(IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT).
--
-- ★ 스코프(이 파일): §2-1 테이블·헬퍼·시드 + junction 자체 RLS 까지.
--   §2-2 당사자 개인정보 테이블(04)의 실무자 SELECT 를 is_assigned 로 좁히는 작업은
--   W 의 verify_assignment_rls.sql(§2-3, test-first 계약) 확정 후 별도로 적용한다.
--   (보안 축소 정책은 검증 계약이 먼저 못박힌 뒤 초록화 — 자기채점 방지.)
-- =====================================================================

-- ── 1. 배정 junction (다대다: 한 당사자에 여러 담당자 가능) ───────────
CREATE TABLE IF NOT EXISTS public.seoul_case_assignments (
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  supporter_id   UUID NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  assigned_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (participant_id, supporter_id)
);

-- 배정 조회는 supporter_id(내 담당 목록)·participant_id(이 당사자의 담당들) 양방향으로 자주 탄다.
CREATE INDEX IF NOT EXISTS idx_seoul_case_assignments_supporter
  ON public.seoul_case_assignments (supporter_id);

-- ── 2. 판정 헬퍼 is_assigned() ───────────────────────────────────────
-- seoul_is_staff_for(단일 FK) 의 다대다 확장판. admin 은 전체(override), supporter 는 배정된
-- 당사자만. 당사자 본인 접근은 기존 self 정책(seoul_is_self)이 담당하므로 여기 넣지 않는다.
CREATE OR REPLACE FUNCTION public.is_assigned(p_participant UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    public.seoul_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.seoul_case_assignments ca
       WHERE ca.participant_id = p_participant
         AND ca.supporter_id = auth.uid()
    );
$$;
COMMENT ON FUNCTION public.is_assigned(UUID) IS
  '담당자 배정 스코핑(§2). admin=전체 true, supporter=seoul_case_assignments 에 (당사자, 나) 존재 시 true. 당사자 본인은 별도 self 정책이 담당.';

-- SECURITY DEFINER 헬퍼: PUBLIC 회수 후 로그인 사용자만 실행(verify §2-3 계약).
REVOKE ALL ON FUNCTION public.is_assigned(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_assigned(UUID) TO authenticated;

-- ── 3. junction 자체 RLS ─────────────────────────────────────────────
-- 읽기: admin 전체 · supporter 는 자기 배정 행 · 당사자 본인은 자기에 관한 행.
-- 쓰기: admin 만(배정 관리는 관리자 권한). 실무자 배정 화면은 후속(관리자 대행 우선).
ALTER TABLE public.seoul_case_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seoul_case_assignments_select ON public.seoul_case_assignments;
CREATE POLICY seoul_case_assignments_select ON public.seoul_case_assignments
  FOR SELECT TO authenticated
  USING (
    public.seoul_is_admin()
    OR supporter_id = auth.uid()
    OR public.seoul_is_self(participant_id)
  );

DROP POLICY IF EXISTS seoul_case_assignments_admin_write ON public.seoul_case_assignments;
CREATE POLICY seoul_case_assignments_admin_write ON public.seoul_case_assignments
  FOR ALL TO authenticated
  USING (public.seoul_is_admin())
  WITH CHECK (public.seoul_is_admin());

-- ── 4. 초기 시드 ─────────────────────────────────────────────────────
-- 현재 전원 열람 운영 → §2-2 로 SELECT 를 좁히면 배정이 비어 실무자 화면이 빈다.
-- 기존 1:1 담당관계(participants.assigned_supporter_id)를 junction 으로 승격 시드한다.
-- (배정이 없는 당사자는 도입 후 admin 이 배정하거나 admin 대행으로 열람 — 운영 마찰 최소화.)
INSERT INTO public.seoul_case_assignments (participant_id, supporter_id)
SELECT id, assigned_supporter_id
  FROM public.participants
 WHERE assigned_supporter_id IS NOT NULL
ON CONFLICT (participant_id, supporter_id) DO NOTHING;
