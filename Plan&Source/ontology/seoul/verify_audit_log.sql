-- =====================================================================
-- 검증 · 통합 감사 로그 seoul_audit_log — 비가역·행위자스탬프·관리자열람·PII최소 계약
--
-- 스펙: Plan&Source/goala_audit_log_W.md §5
-- 대상 구현: supabase/seoul/12_audit_log.sql (테이블 + seoul_audit() SECURITY DEFINER 함수 + RLS/GRANT)
--
-- test-first 계약(W): 이 파일이 초록이면 감사 로그가 (1)행위자를 auth.uid()로 강제 스탬프하고
-- (2)앱은 직접 INSERT/UPDATE/DELETE 못 하며(비가역) (3)관리자만 열람하는 상태로 서 있는 것이다.
-- U(구현)가 12_audit_log.sql 을 만들고 db-verify.yml verify 배열에 verify_audit_log 를 추가하면 발동한다.
--
-- 실행: verify_02_rls/03_graph 와 동일(임시 PostgreSQL 또는 대시보드 SQL Editor).
--        auth stub → seoul 00~05(+07·09·10·12) 적용 뒤 이 파일. 자체 시드(al* 프리픽스)로 자기 것만 본다.
-- 미구현 상태(RED)에서는 아래 존재 판정이 ❌ 를 내 CI 를 실패시킨다(정상).
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── 시드: 관리자 · 실무자 · 당사자(로그인 id 분리) ─────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('a1000000-0000-0000-0000-0000000000ad','al-admin@test.local'),
  ('a1000000-0000-0000-0000-0000000000a2','al-supporter@test.local'),
  ('a1000000-0000-0000-0000-0000000000a3','al-part-login@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('a1000000-0000-0000-0000-0000000000ad','admin','감사관리자'),
  ('a1000000-0000-0000-0000-0000000000a2','supporter','감사실무자'),
  ('a1000000-0000-0000-0000-0000000000a3','participant','감사당사자')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, name=EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id) VALUES
  ('a1100000-0000-0000-0000-000000000001','감사당사자','a1000000-0000-0000-0000-0000000000a3')
ON CONFLICT (id) DO NOTHING;

-- 플레인 PG 에서 SET ROLE authenticated 로 함수 호출·SELECT 가능하도록(정합: 04_rls/12 가 클라우드선 부여)
GRANT USAGE ON SCHEMA public, auth TO authenticated;

-- ★공유 DB 순서오염 방어: 앞선 verify_*.sql 의 GRANT ... ON ALL TABLES ... TO authenticated 가
--   12_audit_log.sql 의 REVOKE 를 덮어써 P5/P6(직접 INSERT/UPDATE/DELETE 차단)를 위양성으로 만든다.
--   프로덕션 의도(테이블 직접 DML 회수)를 여기서 재확립한다. SELECT 은 유지(P7 은 RLS 로 게이팅). 멱등.
REVOKE INSERT, UPDATE, DELETE ON public.seoul_audit_log FROM authenticated;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P1. 테이블·함수 존재'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   seoul_audit_log 테이블: ' ||
  CASE WHEN to_regclass('public.seoul_audit_log') IS NOT NULL THEN '있음 ✅' ELSE '없음 ❌ (U 미구현)' END;
SELECT '   seoul_audit(text,text,uuid,uuid,jsonb) 함수: ' ||
  CASE WHEN to_regprocedure('public.seoul_audit(text,text,uuid,uuid,jsonb)') IS NOT NULL
       THEN '있음 ✅' ELSE '없음 ❌ (U 미구현)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P2. 삽입 함수 = SECURITY DEFINER + search_path 고정'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   SECURITY DEFINER(prosecdef): ' ||
  CASE WHEN COALESCE((SELECT prosecdef FROM pg_proc
                       WHERE oid = to_regprocedure('public.seoul_audit(text,text,uuid,uuid,jsonb)')), FALSE)
       THEN 'true ✅' ELSE 'false ❌ (definer 아니면 직접 INSERT 회수와 모순)' END;
SELECT '   search_path 고정: ' ||
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc
                     WHERE oid = to_regprocedure('public.seoul_audit(text,text,uuid,uuid,jsonb)')
                       AND array_to_string(proconfig,',') LIKE '%search_path%')
       THEN '고정됨 ✅' ELSE '미고정 ❌ (definer 는 search_path 고정 필수)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P3. 실행 권한 — authenticated 에게만, PUBLIC 회수'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   EXECUTE→authenticated: ' ||
  CASE WHEN to_regprocedure('public.seoul_audit(text,text,uuid,uuid,jsonb)') IS NOT NULL
        AND has_function_privilege('authenticated','public.seoul_audit(text,text,uuid,uuid,jsonb)','EXECUTE')
       THEN '있음 ✅' ELSE '없음 ❌ (GRANT EXECUTE TO authenticated 필요)' END;
SELECT '   PUBLIC 실행권한 회수: ' ||
  CASE WHEN (SELECT proacl FROM pg_proc
              WHERE oid = to_regprocedure('public.seoul_audit(text,text,uuid,uuid,jsonb)')) IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
                         WHERE p.oid = to_regprocedure('public.seoul_audit(text,text,uuid,uuid,jsonb)')
                           AND a.grantee=0 AND a.privilege_type='EXECUTE')
       THEN '회수됨 ✅' ELSE '남음 ❌ (REVOKE ALL ON FUNCTION ... FROM PUBLIC 필요)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P4. ★행위자 스탬프 — authenticated 로 함수 호출 시 actor_user_id = 그 auth.uid()'
\echo '       (앱이 다른 actor 를 못 넣는다 — 함수 시그니처에 actor 인자 없음)'
\echo '════════════════════════════════════════════════════════════════'
SET ROLE authenticated;
SET request.jwt.claim.sub = 'a1000000-0000-0000-0000-0000000000ad';  -- 관리자로 가장
-- 함수 호출(부수효과=기록 1건). 미구현(RED)이면 여기서 ERROR(비치명) — 아래 존재/스탬프 판정이 ❌.
SELECT public.seoul_audit('test.audit_selftest','participant',
        'a1100000-0000-0000-0000-000000000001','a1100000-0000-0000-0000-000000000001','{"k":1}'::jsonb);
RESET ROLE;
-- 슈퍼유저로 되돌아와(RLS bypass) 방금 행의 actor 를 확인
SELECT '   방금 기록의 actor_user_id = 호출자(admin): ' ||
  CASE WHEN EXISTS (SELECT 1 FROM public.seoul_audit_log
                     WHERE action='test.audit_selftest'
                       AND actor_user_id='a1000000-0000-0000-0000-0000000000ad')
       THEN '일치 ✅' ELSE '불일치 ❌ (actor 스탬프 실패 — 함수 미구현/미스탬프)' END;
SELECT '   actor_role 스냅샷 기록됨(admin): ' ||
  CASE WHEN EXISTS (SELECT 1 FROM public.seoul_audit_log
                     WHERE action='test.audit_selftest' AND actor_role='admin')
       THEN '기록됨 ✅' ELSE '없음 ❌' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P5. 직접 INSERT 차단 — authenticated 는 테이블에 못 넣는다(함수로만)'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   authenticated 직접 INSERT 권한 없음: ' ||
  CASE WHEN to_regclass('public.seoul_audit_log') IS NULL THEN '테이블 없음 ❌ (U 미구현)'
       WHEN NOT has_table_privilege('authenticated','public.seoul_audit_log','INSERT') THEN '차단됨 ✅'
       ELSE '남음 ❌ (REVOKE INSERT FROM authenticated 필요)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P6. 비가역 — authenticated 는 UPDATE·DELETE 못 한다(append-only)'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   UPDATE 차단: ' ||
  CASE WHEN to_regclass('public.seoul_audit_log') IS NULL THEN '테이블 없음 ❌ (U 미구현)'
       WHEN NOT has_table_privilege('authenticated','public.seoul_audit_log','UPDATE') THEN '차단됨 ✅'
       ELSE '남음 ❌ (REVOKE UPDATE 필요)' END;
SELECT '   DELETE 차단: ' ||
  CASE WHEN to_regclass('public.seoul_audit_log') IS NULL THEN '테이블 없음 ❌ (U 미구현)'
       WHEN NOT has_table_privilege('authenticated','public.seoul_audit_log','DELETE') THEN '차단됨 ✅'
       ELSE '남음 ❌ (REVOKE DELETE 필요)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P7. 열람 관리자 한정(RLS) — admin 은 보이고, 실무자·당사자는 0행'
\echo '════════════════════════════════════════════════════════════════'
SET ROLE authenticated;
SET request.jwt.claim.sub = 'a1000000-0000-0000-0000-0000000000ad';  -- admin
SELECT '   [admin] 감사 로그 열람(≥1): ' ||
  CASE WHEN (SELECT count(*) FROM public.seoul_audit_log WHERE action='test.audit_selftest') >= 1
       THEN '보임 ✅' ELSE '안 보임 ❌ (admin SELECT 정책 확인)' END;
SET request.jwt.claim.sub = 'a1000000-0000-0000-0000-0000000000a2';  -- supporter
SELECT '   [supporter] 감사 로그 0행: ' ||
  CASE WHEN (SELECT count(*) FROM public.seoul_audit_log) = 0
       THEN '차단됨 ✅' ELSE '노출 ❌ (실무자가 감사 로그를 보면 안 됨)' END;
SET request.jwt.claim.sub = 'a1000000-0000-0000-0000-0000000000a3';  -- participant
SELECT '   [participant] 감사 로그 0행: ' ||
  CASE WHEN (SELECT count(*) FROM public.seoul_audit_log) = 0
       THEN '차단됨 ✅' ELSE '노출 ❌' END;
RESET ROLE;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P8. PII 최소(구조적) — 이름·자유서술 원문 컬럼이 테이블에 없다'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   식별정보 원문 컬럼 없음(name/full_name/description/narrative/voice): ' ||
  CASE WHEN to_regclass('public.seoul_audit_log') IS NULL THEN '테이블 없음 ❌ (U 미구현)'
       WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='seoul_audit_log'
                           AND column_name ~* '(name|full_name|description|narrative|voice|content)')
       THEN '✅ (id·코드·jsonb 만)' ELSE '❌ (원문 PII 컬럼 발견 — 제거, metadata 규율은 앱계약)' END;

\echo ''
\echo '=== 검증 종료: 위 결과라인에 ❌ 가 하나도 없어야 계약 통과 ==='
