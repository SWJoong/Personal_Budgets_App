-- =====================================================================
-- 검증 — 당사자 피드백 (participant_feedback) 스키마 + RLS 계약 (관리자 QA G2 복구)
--
-- 설계출처: Plan&Source/goala_participant_feedback_revival_W.md
-- 배경: Seoul 리빌드에서 유실된 레거시 테이블. 코드(saveFeedback/getFeedback/
--       SelfCheckFeedback)는 남아 있고 테이블만 없어 기능 전체가 死였다. 되살린다.
--       모델: participant_id = 피드백을 남긴 로그인 계정(auth uid = profiles.id).
--       RLS = 본인 작성(WITH CHECK self) · 본인+관리자 열람(append-only).
--
-- 확인 항목
--   T0.  테이블·필수 컬럼·NOT NULL 존재 (구현 전이면 RED — 이 계약의 RED 게이트)
--   T1a. RLS 활성
--   T1b. FK participant_id → profiles, ON DELETE CASCADE
--   S1.  본인이 자기 피드백 작성(participant_id=본인) → 성공
--   S2.  ★본인이 남 id 로 스탬프 위조 작성 → WITH CHECK 차단
--   S3.  본인이 자기 피드백 열람 → 봄
--   S4.  ★남(다른 참여자)이 내 피드백 열람 → 0 (유출 차단)
--   S5.  관리자가 전량 열람 → 봄
--
-- ID 접두: 'fb' (hex·다른 verify_*.sql 과 겹치지 않게).
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00,01 → 17_participant_feedback.sql → 이 파일
--            (participant_feedback 는 profiles·seoul_is_admin[01]만 의존).
-- CI: .github/workflows/db-verify.yml 의 verify 배열에 verify_participant_feedback 등록 필요.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 ────────────────────────────────────────────────────────────
-- 피드백을 남기는 주체 = 로그인 계정(profiles). A/B=당사자, admin=관리자.
INSERT INTO auth.users (id, email) VALUES
  ('fbaaaaaa-0000-0000-0000-0000000000a1','fb-a-login@test.local'),   -- 당사자A 로그인
  ('fbbbbbbb-0000-0000-0000-0000000000b1','fb-b-login@test.local'),   -- 당사자B 로그인(남)
  ('fb000000-0000-0000-0000-0000000000ad','fb-admin@test.local')      -- 관리자
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('fbaaaaaa-0000-0000-0000-0000000000a1','participant','피드백당사자A'),
  ('fbbbbbbb-0000-0000-0000-0000000000b1','participant','피드백당사자B'),
  ('fb000000-0000-0000-0000-0000000000ad','admin','피드백관리자')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

\echo '=== T0. 스키마 계약: participant_feedback 테이블·컬럼 (구현 전이면 RED) ==='
SELECT '   T0a. 테이블 존재: ' ||
       CASE WHEN to_regclass('public.participant_feedback') IS NOT NULL THEN '✅' ELSE '❌ 없음(구현 대기)' END;
SELECT '   T0b. 필수 컬럼 5개 전부 존재: ' ||
       CASE WHEN (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='participant_feedback'
                    AND column_name IN ('id','participant_id','context','response','created_at')) = 5
            THEN '✅' ELSE '❌ 누락' END;
SELECT '   T0c. participant_id NOT NULL: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='participant_feedback' AND column_name='participant_id' AND is_nullable='NO')
            THEN '✅' ELSE '❌' END;

\echo ''
\echo '=== T1. RLS·제약 계약 ==='
SELECT '   T1a. RLS 활성: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname='participant_feedback' AND relrowsecurity)
            THEN '✅' ELSE '❌ RLS 꺼짐' END;
\echo '── T1b. FK participant_id → profiles ON DELETE CASCADE (프로필 지우면 피드백도)'
INSERT INTO auth.users (id, email) VALUES
  ('fbcccccc-0000-0000-0000-0000000000c1','fb-c-login@test.local') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, name) VALUES
  ('fbcccccc-0000-0000-0000-0000000000c1','participant','삭제용프로필') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.participant_feedback (id, participant_id, context, response) VALUES
  ('fb700000-0000-0000-0000-0000000000c9','fbcccccc-0000-0000-0000-0000000000c1','온보딩','😊');
DELETE FROM public.profiles WHERE id='fbcccccc-0000-0000-0000-0000000000c1';
SELECT '   지운 프로필의 피드백 잔여: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CASCADE' ELSE '  ❌ 안 지워짐' END
  FROM public.participant_feedback WHERE id='fb700000-0000-0000-0000-0000000000c9';

-- 픽스처: A 의 피드백 1건(superuser 권한, RLS 우회 — 열람 테스트 기준선).
INSERT INTO public.participant_feedback (id, participant_id, context, response) VALUES
  ('fb700000-0000-0000-0000-0000000000a1','fbaaaaaa-0000-0000-0000-0000000000a1','온보딩 3단계','😊')
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '=== 본인(A) — 되어야 하는 것 / 위조는 막혀야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'fbaaaaaa-0000-0000-0000-0000000000a1';
\echo '── S1. 본인이 자기 피드백 작성(participant_id=본인)'
INSERT INTO public.participant_feedback (id, participant_id, context, response) VALUES
  ('fb700000-0000-0000-0000-0000000000a2','fbaaaaaa-0000-0000-0000-0000000000a1','계획 화면','😔');
\echo '── S2. ★본인이 남(B) id 로 스탬프 위조 작성 시도 → WITH CHECK 차단'
INSERT INTO public.participant_feedback (id, participant_id, context, response) VALUES
  ('fb700000-0000-0000-0000-0000000000e1','fbbbbbbb-0000-0000-0000-0000000000b1','위조','😊');
\echo '── S3. 본인이 자기 피드백 열람'
SELECT '   본인이 본 자기 피드백: ' || count(*) ||
       CASE WHEN count(*)>=1 THEN '  ✅' ELSE '  ❌ 본인이 못 봄' END
  FROM public.participant_feedback WHERE participant_id='fbaaaaaa-0000-0000-0000-0000000000a1';
RESET ROLE;
SELECT '   S1 본인 작성 성공: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 본인이 막힘' END
  FROM public.participant_feedback WHERE id='fb700000-0000-0000-0000-0000000000a2';
SELECT '   S2 위조 작성 성공 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ WITH CHECK 방어' ELSE '  ❌ 스탬프 위조 뚫림' END
  FROM public.participant_feedback WHERE id='fb700000-0000-0000-0000-0000000000e1';

\echo ''
\echo '=== 남(당사자B) — 반드시 막혀야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'fbbbbbbb-0000-0000-0000-0000000000b1';
\echo '── S4. ★남이 A 피드백 열람 시도 → 0 (유출 차단)'
SELECT '   B 가 본 A 피드백: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 유출' END
  FROM public.participant_feedback WHERE participant_id='fbaaaaaa-0000-0000-0000-0000000000a1';
RESET ROLE;

\echo ''
\echo '=== 관리자 — 전량 열람 되어야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'fb000000-0000-0000-0000-0000000000ad';
\echo '── S5. 관리자가 A 피드백 열람'
SELECT '   관리자가 본 A 피드백: ' || count(*) ||
       CASE WHEN count(*)>=1 THEN '  ✅' ELSE '  ❌ 관리자가 못 봄' END
  FROM public.participant_feedback WHERE participant_id='fbaaaaaa-0000-0000-0000-0000000000a1';
RESET ROLE;

\echo ''
\echo '=== 당사자 피드백(participant_feedback) 계약 검증 끝 ==='
