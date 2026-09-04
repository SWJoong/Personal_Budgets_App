-- =====================================================================
-- 12 · 통합 감사 로그 seoul_audit_log
--
-- 설계: Plan&Source/goala_audit_log_W.md · 계약: Plan&Source/ontology/seoul/verify_audit_log.sql
-- 원칙 4가지: (1)비가역 append-only (2)행위자 위조불가(auth.uid() 스탬프) (3)식별정보 최소(원문 PII 금지)
--            (4)열람은 관리자(seoul_is_admin())만.
-- 기록은 SECURITY DEFINER 함수 seoul_audit() 로만(테이블 직접 DML 회수). seoul_provider_domains()(11)와 동형 관용구.
-- 멱등: 재적용 무오류(IF NOT EXISTS · CREATE OR REPLACE · DROP POLICY IF EXISTS · REVOKE/GRANT).
-- =====================================================================

-- ── 테이블 (append-only 신호로 updated_at 없음) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.seoul_audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,          -- 누가(=auth.uid, 함수가 스탬프)
  actor_role            TEXT,                                                        -- 당시 역할 스냅샷
  action                TEXT NOT NULL,                                               -- 무엇(코드)
  target_type           TEXT,                                                        -- 대상 종류
  target_id             UUID,                                                        -- 대상 id
  target_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,  -- 당사자 스코프(있으면)
  metadata              JSONB NOT NULL DEFAULT '{}',                                 -- ★코드·id·수치만(원문 PII 금지)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_participant ON public.seoul_audit_log (target_participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor       ON public.seoul_audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON public.seoul_audit_log (action, created_at DESC);

-- ── 삽입 함수 (SECURITY DEFINER — 행위자 스탬프·직접 INSERT 차단) ──────────────
CREATE OR REPLACE FUNCTION public.seoul_audit(
  p_action         TEXT,
  p_target_type    TEXT  DEFAULT NULL,
  p_target_id      UUID  DEFAULT NULL,
  p_participant_id UUID  DEFAULT NULL,
  p_metadata       JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp     -- definer 필수(권한상승 방지)
AS $$
DECLARE
  v_id   UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'seoul_audit: 인증 필요';   -- 익명 스탬프 금지
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.seoul_audit_log
    (actor_user_id, actor_role, action, target_type, target_id, target_participant_id, metadata)
  VALUES
    (auth.uid(), v_role, p_action, p_target_type, p_target_id, p_participant_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL     ON FUNCTION public.seoul_audit(TEXT, TEXT, UUID, UUID, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.seoul_audit(TEXT, TEXT, UUID, UUID, JSONB) TO authenticated;

-- ── RLS·권한 (append-only + 관리자 열람) ──────────────────────────────────────
ALTER TABLE public.seoul_audit_log ENABLE ROW LEVEL SECURITY;

-- 읽기: 관리자만. INSERT/UPDATE/DELETE 정책 없음 → RLS 로 전부 차단.
DROP POLICY IF EXISTS seoul_audit_log_select ON public.seoul_audit_log;
CREATE POLICY seoul_audit_log_select ON public.seoul_audit_log
  FOR SELECT USING (public.seoul_is_admin());

-- 테이블 직접 DML 권한 회수: 삽입은 definer 함수로만, 수정·삭제는 아무도 못 함(append-only).
REVOKE INSERT, UPDATE, DELETE ON public.seoul_audit_log FROM authenticated;
GRANT  SELECT                 ON public.seoul_audit_log TO authenticated;  -- RLS 가 관리자로 좁힘
