-- =====================================================================
-- 17 · 당사자 피드백 (participant_feedback)  —  관리자 QA G2 복구  —  U(backend) 구현
--
--      설계권위: Plan&Source/goala_participant_feedback_revival_W.md
--      계약:     Plan&Source/ontology/seoul/verify_participant_feedback.sql
--
-- 배경: Seoul 리빌드에서 유실된 레거시 테이블. 코드(saveFeedback·getFeedback·
--       SelfCheckFeedback·/admin/feedback)는 전부 남아 있고 테이블만 없어 기능이
--       死였다 — 테이블만 되살려 복원한다(앱 코드 무변경, 순수 DB 슬라이스).
-- 모델: participant_id = "피드백을 남긴 로그인 계정"(auth uid = profiles.id).
--       컬럼명은 레거시 오칭이나 앱 코드가 이미 이 이름을 쓰므로 유지하고 COMMENT 로 명시.
--       FK 대상이 profiles(id)인 이유: saveFeedback 이 user.id(auth uid)를 넣고
--       getFeedback 이 profiles 로 이름 조인 → 참조무결성·이름조인 둘 다 profiles(id)가 만족.
-- RLS : 본인 작성(INSERT WITH CHECK participant_id=auth.uid() — 스탬프 위조 차단) ·
--       본인+관리자 열람(SELECT USING self OR seoul_is_admin()) · UPDATE/DELETE 정책
--       없음 → append-only(정책 부재 = RLS 기본 거부). getFeedback 은 service role 로
--       우회 읽되(코드 admin 게이트 별도) SELECT 정책으로 방어심층.
-- 멱등: CREATE TABLE/INDEX IF NOT EXISTS · DROP POLICY IF EXISTS 후 재생성 → 재실행 가능.
-- 의존: profiles(01) · seoul_is_admin()(01_core.sql, SECURITY DEFINER 헬퍼). → 01 이후 아무 때나.
-- =====================================================================

-- ── §1. 테이블 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.participant_feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context        TEXT,                                -- 어느 화면/맥락(예: 온보딩 단계)
  response       TEXT,                                -- 감정 이모지(😊/😔) 또는 자유 응답
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.participant_feedback IS
  '당사자 피드백(온보딩 😊/😔·자유응답). participant_id 는 레거시 오칭 — 실제로는 피드백을 남긴 로그인 계정(auth uid = profiles.id)이다. RLS=본인 작성·본인+관리자 열람(append-only).';

CREATE INDEX IF NOT EXISTS idx_participant_feedback_participant
  ON public.participant_feedback(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_feedback_created
  ON public.participant_feedback(created_at DESC);   -- getFeedback 정렬(order by created_at desc)

-- ── §2. RLS (본인 작성 / 본인·관리자 열람 · append-only) ───────────────
-- 헬퍼: seoul_is_admin() = 01_core 의 SECURITY DEFINER(profiles.role='admin').
ALTER TABLE public.participant_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS participant_feedback_insert ON public.participant_feedback;
CREATE POLICY participant_feedback_insert ON public.participant_feedback
  FOR INSERT TO authenticated WITH CHECK (participant_id = auth.uid());

DROP POLICY IF EXISTS participant_feedback_select ON public.participant_feedback;
CREATE POLICY participant_feedback_select ON public.participant_feedback
  FOR SELECT TO authenticated USING (participant_id = auth.uid() OR public.seoul_is_admin());

-- UPDATE/DELETE 정책 없음 → append-only(정책 부재 = RLS 기본 거부, 수정·삭제 불가).
