-- =====================================================================
-- 검증 · GOAL축 B — 욕구사정 RLS 권한 계약 (특히 DELETE)
--
-- 결정(2026-08-19, W 설계권위 + 사용자): 욕구사정 삭제를 **담당 실무자에게 허용**한다.
--   기존 09 정책 seoul_needs_assessment_delete = seoul_is_admin() (관리자 전용) 이,
--   사정을 작성한 담당자 본인도 못 지우는 UX 불일치를 낳았다(PR #22 검토).
--   → U 가 09 의 DELETE 정책을 seoul_is_staff_for(participant_id) 로 바꾼다(insert/update 와 일관).
--     seoul_is_staff_for = seoul_is_admin() OR 담당(assigned_supporter_id=auth.uid()) 이므로
--     관리자·담당자 삭제 허용 / 비담당 차단이 동시에 성립한다.
--
-- ★ test-first: 이 파일 [3] 은 09 변경 **전에는 ❌**(admin-only 라 담당자 삭제 막힘) →
--    U 가 정책을 seoul_is_staff_for 로 바꾸면 ✅. [1][2][4] 는 변경 전후 모두 ✅ 여야 한다.
--
-- 실행: verify_00_auth_stub → supabase/seoul/00~05 + 07 + 09 + 10 적용 후 psql -f 이 파일.
--        (RLS 를 실제로 태우므로 소유자가 아니라 role 'alice' + jwt.claim.sub 로 사용자를 흉내낸다.)
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
RESET ROLE;

-- authenticated 권한 + 테스트 로그인 롤 alice (verify_02 와 동일 관용구, 멱등)
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 (ba 접두 — 다른 verify 와 충돌 없음). 재실행 가능 ──
DELETE FROM public.participants WHERE id='ba000000-0000-0000-0000-0000000000d1';

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001','admin@test.local'),
  ('ba000000-0000-0000-0000-0000000000a1','staffA@test.local'),   -- 담당 실무자
  ('ba000000-0000-0000-0000-0000000000b1','staffB@test.local'),   -- 비담당 실무자
  ('ba000000-0000-0000-0000-0000000000c1','partlogin@test.local') -- 당사자 로그인
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('00000000-0000-0000-0000-000000000001','admin','관리자'),
  ('ba000000-0000-0000-0000-0000000000a1','supporter','담당A'),
  ('ba000000-0000-0000-0000-0000000000b1','supporter','비담당B'),
  ('ba000000-0000-0000-0000-0000000000c1','participant','당사자')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- 참여자: 내부 키(d1) ≠ 로그인 id(c1). 담당 실무자 = staffA.
INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('ba000000-0000-0000-0000-0000000000d1','검증-당사자',
   'ba000000-0000-0000-0000-0000000000c1','ba000000-0000-0000-0000-0000000000a1');

\echo ''
\echo '=== 욕구사정 DELETE 권한 계약 (담당자 허용 / 비담당 차단 / 관리자 허용) ==='

-- ── [1] 담당A 가 사정 생성 (insert=seoul_is_staff_for → 담당이라 허용) ──
SET ROLE alice;
SET request.jwt.claim.sub = 'ba000000-0000-0000-0000-0000000000a1';
INSERT INTO public.seoul_needs_assessment (id, participant_id, program, domain_id, assessed_by, limitation)
  SELECT 'ba000000-0000-0000-0000-0000000000e1','ba000000-0000-0000-0000-0000000000d1','seoul',
         d.id,'ba000000-0000-0000-0000-0000000000a1','혼자 이동이 어려움'
    FROM public.seoul_service_domains d WHERE d.program='seoul' AND d.code='daily_living';
RESET ROLE;
SELECT '[1] 담당A 생성: ' || count(*) ||
       CASE WHEN count(*)=1 THEN ' ✅' ELSE ' ❌ (담당 insert 가 막힘)' END
  FROM public.seoul_needs_assessment WHERE id='ba000000-0000-0000-0000-0000000000e1';

-- ── [2] 비담당B 가 삭제 시도 → 차단되어야(변경 전후 모두 ✅) ──
SET ROLE alice;
SET request.jwt.claim.sub = 'ba000000-0000-0000-0000-0000000000b1';
DELETE FROM public.seoul_needs_assessment WHERE id='ba000000-0000-0000-0000-0000000000e1';
RESET ROLE;
SELECT '[2] 비담당B 삭제 차단: ' || count(*) ||
       CASE WHEN count(*)=1 THEN ' ✅ 방어됨(1행 유지)' ELSE ' ❌ 뚫림' END
  FROM public.seoul_needs_assessment WHERE id='ba000000-0000-0000-0000-0000000000e1';

-- ── [3] 담당A 가 삭제 시도 → 허용되어야(★ 09 변경 전 ❌ / seoul_is_staff_for 로 바꾸면 ✅) ──
SET ROLE alice;
SET request.jwt.claim.sub = 'ba000000-0000-0000-0000-0000000000a1';
DELETE FROM public.seoul_needs_assessment WHERE id='ba000000-0000-0000-0000-0000000000e1';
RESET ROLE;
SELECT '[3] 담당A 삭제 허용: ' ||
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.seoul_needs_assessment
                              WHERE id='ba000000-0000-0000-0000-0000000000e1')
            THEN '삭제됨 ✅'
            ELSE '1행 남음 ❌ (아직 admin-only — 09 DELETE 정책을 seoul_is_staff_for 로)' END;

-- ── [4] 관리자 삭제 → 허용 유지(재삽입 후 admin 삭제) ──
INSERT INTO public.seoul_needs_assessment (id, participant_id, program, domain_id, assessed_by)
  SELECT 'ba000000-0000-0000-0000-0000000000e1','ba000000-0000-0000-0000-0000000000d1','seoul',
         d.id,'ba000000-0000-0000-0000-0000000000a1'
    FROM public.seoul_service_domains d WHERE d.program='seoul' AND d.code='daily_living'
ON CONFLICT (id) DO NOTHING;
SET ROLE alice;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.seoul_needs_assessment WHERE id='ba000000-0000-0000-0000-0000000000e1';
RESET ROLE;
SELECT '[4] 관리자 삭제 허용: ' ||
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.seoul_needs_assessment
                              WHERE id='ba000000-0000-0000-0000-0000000000e1')
            THEN '삭제됨 ✅' ELSE '1행 남음 ❌' END;

-- ── 정리 ──
DELETE FROM public.participants WHERE id='ba000000-0000-0000-0000-0000000000d1';

\echo ''
\echo '=== 판정: [1][2][4] 는 항상 ✅ / [3] 은 09 DELETE=seoul_is_staff_for 반영 후 ✅ ==='
