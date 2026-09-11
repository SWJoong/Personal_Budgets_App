-- =====================================================================
-- 18 · SIS-A 지원요구척도 (sis_assessments)  —  관리자 QA #9 부활  —  U(backend) 구현
--
--      설계권위: Plan&Source/goala_sis_a_revival_W.md
--      계약:     Plan&Source/ontology/seoul/verify_sis_assessments.sql
--
-- 배경: Seoul 리빌드에서 유실된 레거시 테이블(_archive/15_sis_assessments.sql). 채점 로직
--       src/utils/sis-a.ts(calculateSisA)는 생존했으나 저장 테이블·기록 UI 가 빠져 기능이
--       死였다 — 테이블을 서울 신원·RLS 규약으로 되살린다. (레거시 대비: creator_id→auth.users 를
--       created_by→profiles(id) 로, admin/supporter EXISTS 정책을 seoul 헬퍼로 교체.)
-- 모델: SIS-A(지원요구척도) 6개 하위척도(2A 가정생활·2B 지역사회생활·2C 평생학습·2D 고용·
--       2E 건강&안전·2F 사회). 원점수(raw_2a..raw_2f) → 표준점수(std_2a..std_2f) →
--       총점(total_std)·지원요구지수(index_score 예 "128-129")·백분위(percentile 예 ">99").
--       변환은 앱(calculateSisA)이 산출하고 이 테이블은 결과 스냅샷을 저장한다.
-- RLS : 사정성 정보 — 열람 seoul_can_access(본인 + 담당/관리자, 아카이브도 당사자 본인 열람 허용) ·
--       기록/수정/삭제 seoul_is_staff_for(실무자·관리자만, 본인 제외).
-- 멱등: CREATE TABLE/INDEX IF NOT EXISTS · DROP POLICY IF EXISTS 후 재생성 → 재실행 가능.
-- 의존: participants(01) · seoul_can_access()·seoul_is_staff_for()(01_core.sql, SECURITY DEFINER
--       헬퍼). → 01 이후 아무 때나.
-- =====================================================================

-- ── §1. 테이블 ────────────────────────────────────────────────────────
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

  created_by  UUID REFERENCES public.profiles(id),  -- 서울 규약(auth.users 아님) — 기록한 실무자
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.sis_assessments IS
  'SIS-A(지원요구척도) 평가 결과. 6개 하위척도 원점수(raw_2a..raw_2f)→표준점수(std_2a..std_2f)→총점·지원요구지수·백분위. RLS=열람 seoul_can_access(본인+담당/관리자)·기록 seoul_is_staff_for(실무자만).';

CREATE INDEX IF NOT EXISTS idx_sis_assessments_participant
  ON public.sis_assessments(participant_id);
CREATE INDEX IF NOT EXISTS idx_sis_assessments_participant_assessed
  ON public.sis_assessments(participant_id, assessed_at DESC);  -- 목록 정렬(최신 사정 우선)

-- ── §2. RLS (열람 seoul_can_access / 기록·수정·삭제 seoul_is_staff_for) ──
-- 헬퍼: seoul_can_access = 본인(seoul_is_self) OR 담당/관리자(seoul_is_staff_for);
--       seoul_is_staff_for = 관리자 OR 배정 실무자(본인 제외) — 둘 다 01_core SECURITY DEFINER.
ALTER TABLE public.sis_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sis_assessments_select ON public.sis_assessments;
CREATE POLICY sis_assessments_select ON public.sis_assessments
  FOR SELECT TO authenticated
  USING (public.seoul_can_access(participant_id));

DROP POLICY IF EXISTS sis_assessments_insert ON public.sis_assessments;
CREATE POLICY sis_assessments_insert ON public.sis_assessments
  FOR INSERT TO authenticated
  WITH CHECK (public.seoul_is_staff_for(participant_id));

DROP POLICY IF EXISTS sis_assessments_update ON public.sis_assessments;
CREATE POLICY sis_assessments_update ON public.sis_assessments
  FOR UPDATE TO authenticated
  USING (public.seoul_is_staff_for(participant_id))
  WITH CHECK (public.seoul_is_staff_for(participant_id));

DROP POLICY IF EXISTS sis_assessments_delete ON public.sis_assessments;
CREATE POLICY sis_assessments_delete ON public.sis_assessments
  FOR DELETE TO authenticated
  USING (public.seoul_is_staff_for(participant_id));
