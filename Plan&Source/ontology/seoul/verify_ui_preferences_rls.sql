-- =====================================================================
-- 검증 · GOAL축 A — 화면 개인화(ui_preferences) RLS 보안 계약
--
-- 불변식(02_core_rls.sql, protect_participant_fields 트리거):
--   "당사자 본인의 participants UPDATE 는 ui_preferences 만 반영되고, 나머지 행정 필드는
--    트리거가 원래 값으로 되돌린다(본인 편집은 화면 설정뿐)."
--   담당 실무자/관리자는 전 필드 편집 가능. 비담당·비본인은 UPDATE 자체가 RLS 로 막힌다.
--
-- 이 계약은 지금 green(트리거·정책 기존 존재) = 회귀 잠금. 화면 개인화 기능이 이 경로로
-- 저장하므로, 트리거/정책이 훼손되면 당사자가 담당자·연결계정 등을 자가 변경하게 된다(보안 결함).
--
-- 실행: verify_00_auth_stub → supabase/seoul/00~02(+03..) 적용 후 psql -f 이 파일.
--        RLS 를 실제로 태우므로 role 'alice' + request.jwt.claim.sub 로 사용자를 흉내낸다
--        (verify_02_rls·verify_needs_assessment_rls 와 동일 관용구).
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
RESET ROLE;

GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 (bp 접두 — 다른 verify 와 충돌 없음). 재실행 가능 ──
DELETE FROM public.participants WHERE id='bp000000-0000-0000-0000-0000000000d1';

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001','admin@test.local'),
  ('bp000000-0000-0000-0000-0000000000a1','staffA-pref@test.local'),   -- 담당 실무자
  ('bp000000-0000-0000-0000-0000000000b1','staffB-pref@test.local'),   -- 비담당 실무자
  ('bp000000-0000-0000-0000-0000000000c1','partlogin-pref@test.local') -- 당사자 로그인
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('00000000-0000-0000-0000-000000000001','admin','관리자'),
  ('bp000000-0000-0000-0000-0000000000a1','supporter','담당A-pref'),
  ('bp000000-0000-0000-0000-0000000000b1','supporter','비담당B-pref'),
  ('bp000000-0000-0000-0000-0000000000c1','participant','당사자-pref')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- 참여자: 내부 키(d1) ≠ 로그인 id(c1). 담당 = staffA. 초기 화면설정·이름 고정.
INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id, ui_preferences) VALUES
  ('bp000000-0000-0000-0000-0000000000d1','개인화-당사자',
   'bp000000-0000-0000-0000-0000000000c1','bp000000-0000-0000-0000-0000000000a1',
   '{"t":"init"}'::jsonb);

\echo ''
\echo '=== 화면 개인화 RLS 계약 (본인=ui_preferences만 / 비담당=차단 / 담당=전필드) ==='

-- ── [1] 당사자 본인(sub=c1): ui_preferences 는 바뀌고, 이름(행정필드)은 트리거가 되돌린다 ──
SET ROLE alice;
SET request.jwt.claim.sub = 'bp000000-0000-0000-0000-0000000000c1';
UPDATE public.participants
   SET ui_preferences = '{"t":"self"}'::jsonb,
       name           = '해킹시도-이름변경'
 WHERE id = 'bp000000-0000-0000-0000-0000000000d1';
RESET ROLE;
SELECT '[1a] 본인 ui_preferences 반영: ' ||
       CASE WHEN ui_preferences->>'t' = 'self' THEN '✅' ELSE '❌ (본인 화면설정 저장 실패)' END
  FROM public.participants WHERE id='bp000000-0000-0000-0000-0000000000d1';
SELECT '[1b] 본인 이름 변경 차단(트리거 되돌림): ' ||
       CASE WHEN name = '개인화-당사자' THEN '✅ 방어됨' ELSE '❌ 뚫림('||name||')' END
  FROM public.participants WHERE id='bp000000-0000-0000-0000-0000000000d1';

-- ── [2] 비담당 실무자(sub=b1): UPDATE 자체가 RLS 로 막혀 ui_preferences 불변 ──
SET ROLE alice;
SET request.jwt.claim.sub = 'bp000000-0000-0000-0000-0000000000b1';
UPDATE public.participants
   SET ui_preferences = '{"t":"intruder"}'::jsonb
 WHERE id = 'bp000000-0000-0000-0000-0000000000d1';
RESET ROLE;
SELECT '[2] 비담당 UPDATE 차단: ' ||
       CASE WHEN ui_preferences->>'t' = 'self' THEN '✅ 방어됨(불변)' ELSE '❌ 뚫림('||COALESCE(ui_preferences->>'t','null')||')' END
  FROM public.participants WHERE id='bp000000-0000-0000-0000-0000000000d1';

-- ── [3] 담당 실무자(sub=a1): 전 필드 편집 허용(ui_preferences + 이름 모두 반영) ──
SET ROLE alice;
SET request.jwt.claim.sub = 'bp000000-0000-0000-0000-0000000000a1';
UPDATE public.participants
   SET ui_preferences = '{"t":"staff"}'::jsonb,
       name           = '담당이-정정한-이름'
 WHERE id = 'bp000000-0000-0000-0000-0000000000d1';
RESET ROLE;
SELECT '[3] 담당 전필드 편집 허용: ' ||
       CASE WHEN ui_preferences->>'t' = 'staff' AND name = '담당이-정정한-이름'
            THEN '✅' ELSE '❌ (담당 편집이 막힘/부분반영)' END
  FROM public.participants WHERE id='bp000000-0000-0000-0000-0000000000d1';

-- ── 정리 ──
DELETE FROM public.participants WHERE id='bp000000-0000-0000-0000-0000000000d1';

\echo ''
\echo '=== 판정: [1a][1b][2][3] 모두 ✅ 여야 한다(전부 지금 green = 회귀 잠금) ==='
