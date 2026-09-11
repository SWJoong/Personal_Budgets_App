-- =====================================================================
-- 검증 — SIS-A 지원요구척도 (sis_assessments) 스키마 + RLS 계약 (관리자 QA #9 부활)
--
-- 설계출처: Plan&Source/goala_sis_a_revival_W.md
-- 배경: Seoul 리빌드에서 유실된 레거시 테이블(_archive/15_sis_assessments.sql). 채점 로직
--       src/utils/sis-a.ts(calculateSisA)는 생존 — 테이블·UI 를 되살린다.
--       RLS = 사정성 정보: 열람 seoul_can_access(본인+담당/관리자), 기록 seoul_is_staff_for(실무자만).
--
-- 확인 항목
--   T0.  테이블·필수 컬럼(원점수 6·표준점수 6·total/index/percentile)·NOT NULL (구현 전 RED)
--   T1a. RLS 활성 / T1b. FK participant_id → participants ON DELETE CASCADE
--   S1.  담당 실무자가 A 의 SIS 기록·열람
--   S2.  ★본인(A)이 자기 SIS 열람(seoul_can_access self)
--   S3.  ★남(B)이 A 의 SIS 열람 → 0 (유출 차단)
--   S4.  본인(A)이 자기 SIS 기록 시도 → 차단(staff 아님)
--
-- ID 접두: 'ca' (hex·다른 verify 와 비겹침). 실행: verify_00_auth_stub → 00,01 → 18 → 이 파일.
-- CI: db-verify.yml verify 배열에 verify_sis_assessments 등록.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 ────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('caaaaaaa-0000-0000-0000-0000000000a1','sis-a-login@test.local'),   -- 당사자A 로그인
  ('cabbbbbb-0000-0000-0000-0000000000b1','sis-b-login@test.local'),   -- 당사자B 로그인(남)
  ('ca000000-0000-0000-0000-0000000000ff','sis-staff@test.local')      -- 담당 실무자
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('caaaaaaa-0000-0000-0000-0000000000a1','participant','SIS당사자A'),
  ('cabbbbbb-0000-0000-0000-0000000000b1','participant','SIS당사자B'),
  ('ca000000-0000-0000-0000-0000000000ff','supporter','SIS실무자')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('ca111111-1111-1111-1111-111111111111','SIS당사자A',
     'caaaaaaa-0000-0000-0000-0000000000a1','ca000000-0000-0000-0000-0000000000ff'),
  ('ca222222-2222-2222-2222-222222222222','SIS당사자B',
     'cabbbbbb-0000-0000-0000-0000000000b1','ca000000-0000-0000-0000-0000000000ff')
ON CONFLICT (id) DO NOTHING;

\echo '=== T0. 스키마 계약: sis_assessments 테이블·컬럼 (구현 전이면 RED) ==='
SELECT '   T0a. 테이블 존재: ' ||
       CASE WHEN to_regclass('public.sis_assessments') IS NOT NULL THEN '✅' ELSE '❌ 없음(구현 대기)' END;
SELECT '   T0b. 원점수6+표준점수6+지수 컬럼 전부 존재: ' ||
       CASE WHEN (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='sis_assessments'
                    AND column_name IN ('raw_2a','raw_2b','raw_2c','raw_2d','raw_2e','raw_2f',
                                        'std_2a','std_2b','std_2c','std_2d','std_2e','std_2f',
                                        'total_std','index_score','percentile')) = 15
            THEN '✅' ELSE '❌ 누락' END;
SELECT '   T0c. participant_id NOT NULL: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='sis_assessments' AND column_name='participant_id' AND is_nullable='NO')
            THEN '✅' ELSE '❌' END;

\echo ''
\echo '=== T1. RLS·FK 계약 ==='
SELECT '   T1a. RLS 활성: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname='sis_assessments' AND relrowsecurity)
            THEN '✅' ELSE '❌ RLS 꺼짐' END;
\echo '── T1b. FK participant_id → participants ON DELETE CASCADE'
INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('ca333333-3333-3333-3333-333333333333','삭제용',NULL,'ca000000-0000-0000-0000-0000000000ff') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sis_assessments (id, participant_id, raw_2a, index_score, percentile) VALUES
  ('ca700000-0000-0000-0000-0000000000c9','ca333333-3333-3333-3333-333333333333',10,'100','50');
DELETE FROM public.participants WHERE id='ca333333-3333-3333-3333-333333333333';
SELECT '   지운 당사자의 SIS 잔여: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CASCADE' ELSE '  ❌ 안 지워짐' END
  FROM public.sis_assessments WHERE id='ca700000-0000-0000-0000-0000000000c9';

\echo ''
\echo '=== 담당 실무자 — 기록·열람 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ca000000-0000-0000-0000-0000000000ff';
\echo '── S1. 담당 실무자가 A 의 SIS 기록'
INSERT INTO public.sis_assessments
  (id, participant_id, raw_2a, raw_2b, std_2a, std_2b, total_std, index_score, percentile, created_by)
VALUES ('ca700000-0000-0000-0000-0000000000f1','ca111111-1111-1111-1111-111111111111',
        50,40,10,9,60,'100','50','ca000000-0000-0000-0000-0000000000ff');
SELECT '   실무자가 본 A SIS: ' || count(*) ||
       CASE WHEN count(*)>=1 THEN '  ✅' ELSE '  ❌ 실무자가 못 봄' END
  FROM public.sis_assessments WHERE participant_id='ca111111-1111-1111-1111-111111111111';
RESET ROLE;
SELECT '   S1 실무자 기록 성공: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 실무자가 막힘' END
  FROM public.sis_assessments WHERE id='ca700000-0000-0000-0000-0000000000f1';

\echo ''
\echo '=== 본인(A) — 열람 가능·기록 불가 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'caaaaaaa-0000-0000-0000-0000000000a1';
\echo '── S2. 본인이 자기 SIS 열람(seoul_can_access self)'
SELECT '   본인이 본 자기 SIS: ' || count(*) ||
       CASE WHEN count(*)>=1 THEN '  ✅' ELSE '  ❌ 본인이 못 봄' END
  FROM public.sis_assessments WHERE participant_id='ca111111-1111-1111-1111-111111111111';
\echo '── S4. 본인이 자기 SIS 기록 시도 → staff 아니라 차단'
INSERT INTO public.sis_assessments (id, participant_id, raw_2a, index_score, percentile) VALUES
  ('ca700000-0000-0000-0000-0000000000e1','ca111111-1111-1111-1111-111111111111',5,'90','25');
RESET ROLE;
SELECT '   S4 본인 무단기록 성공: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.sis_assessments WHERE id='ca700000-0000-0000-0000-0000000000e1';

\echo ''
\echo '=== 남(B) — 열람 차단 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'cabbbbbb-0000-0000-0000-0000000000b1';
\echo '── S3. 남이 A 의 SIS 열람 → 0'
SELECT '   B 가 본 A SIS: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 유출' END
  FROM public.sis_assessments WHERE participant_id='ca111111-1111-1111-1111-111111111111';
RESET ROLE;

\echo ''
\echo '=== SIS-A(sis_assessments) 계약 검증 끝 ==='
