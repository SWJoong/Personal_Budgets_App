-- =====================================================================
-- 검증 · 담당자 배정 스코핑 — 교차 supporter 격리 (B4 §2-3, test-first 계약)
--
-- 스펙: Plan&Source/goala_privacy_deid_assignment_W.md §2
--
-- ★재정합 노트(실 W): §2 설계는 처음에 신규 M:N 테이블(seoul_case_assignments)+is_assigned()
--   를 제안했으나, 실측 결과 배정 스코핑은 **이미 구현·작동 중**이다 —
--   participants.assigned_supporter_id(01_core §7) + seoul_is_staff_for()(admin OR 배정) +
--   seoul_can_access()(self OR staff_for). 04_seoul_rls 의 당사자 개인정보 SELECT 는 전부
--   seoul_can_access(participant_id) 로 스코프된다. 따라서 이 파일은 **새 메커니즘을 요구하지 않고,
--   기존 RLS 의 관찰가능 동작(= 교차 supporter 격리)을 골든으로 잠근다**(회귀 차단).
--   PR #66(M:N junction)은 이 동작을 바꾸지 않는 additive 확장이며, 채택 여부는 별개 결정.
--
-- 이 계약이 초록이면: "실무자는 배정된 당사자만, 미배정은 아무것도, 관리자는 전체" 가 서 있다.
--
-- 실행: verify_02_rls 와 동일(임시 PostgreSQL 또는 대시보드 SQL Editor).
--        auth stub → seoul 00~04 적용 뒤 이 파일. 자체 시드(ba* 프리픽스)로 자기 것만 본다.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── 시드: 지원자 3(S1·S2·S3-미배정) + 관리자 + 당사자 2(P1→S1, P2→S2) ─────────
-- 로그인 id(auth.uid) = profiles.id. 참여자 내부 키(ba1..)는 로그인과 분리.
INSERT INTO auth.users (id, email) VALUES
  ('ba000000-0000-0000-0000-0000000000a1','asg-s1@test.local'),
  ('ba000000-0000-0000-0000-0000000000a2','asg-s2@test.local'),
  ('ba000000-0000-0000-0000-0000000000a3','asg-s3@test.local'),
  ('ba000000-0000-0000-0000-0000000000ad','asg-admin@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('ba000000-0000-0000-0000-0000000000a1','supporter','지원자하나'),
  ('ba000000-0000-0000-0000-0000000000a2','supporter','지원자둘'),
  ('ba000000-0000-0000-0000-0000000000a3','supporter','지원자셋'),
  ('ba000000-0000-0000-0000-0000000000ad','admin','관리자')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, name=EXCLUDED.name;

-- P1 은 S1 에게, P2 는 S2 에게 배정. S3 은 아무에게도 배정되지 않음(미배정 지원자).
INSERT INTO public.participants (id, name, assigned_supporter_id) VALUES
  ('ba100000-0000-0000-0000-000000000001','당사자가','ba000000-0000-0000-0000-0000000000a1'),
  ('ba100000-0000-0000-0000-000000000002','당사자나','ba000000-0000-0000-0000-0000000000a2')
ON CONFLICT (id) DO UPDATE SET assigned_supporter_id=EXCLUDED.assigned_supporter_id;

-- 각 당사자의 모니터링 1건(개인정보 테이블 SELECT 스코프 확인용). 명시 id 로 재실행 멱등.
INSERT INTO public.seoul_monitoring_records (id, participant_id, monitoring_date, method, observed_change, caseworker_id) VALUES
  ('ba200000-0000-0000-0000-000000000001','ba100000-0000-0000-0000-000000000001','2026-01-10','visit','P1 관찰','ba000000-0000-0000-0000-0000000000a1'),
  ('ba200000-0000-0000-0000-000000000002','ba100000-0000-0000-0000-000000000002','2026-01-11','visit','P2 관찰','ba000000-0000-0000-0000-0000000000a2')
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '=== A0. 헬퍼 무결성 — seoul_is_staff_for (배정 스코핑의 근거 함수) ==='
SELECT '   prosecdef(SECURITY DEFINER): ' ||
  CASE WHEN COALESCE((SELECT prosecdef FROM pg_proc WHERE proname='seoul_is_staff_for'),FALSE)
       THEN 'true  ✅' ELSE 'false  ❌' END;
SELECT '   search_path 고정: ' ||
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='seoul_is_staff_for'
                     AND array_to_string(proconfig,',') LIKE '%search_path%')
       THEN '설정됨  ✅' ELSE '없음  ❌' END;

\echo ''
\echo '=== A1. 지원자1(S1) — 배정된 P1 만 보인다(P2 격리) ==='
SET ROLE authenticated;
SET request.jwt.claim.sub = 'ba000000-0000-0000-0000-0000000000a1';
SELECT '   A1a. 참여자 1명(P1)만: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌' END
  FROM public.participants;
SELECT '   A1b. ★P2 격리(안 보임): ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.participants WHERE id='ba100000-0000-0000-0000-000000000002';
SELECT '   A1c. 모니터링 P1 것만: ' || count(*) ||
       CASE WHEN count(*)=1 AND bool_and(participant_id='ba100000-0000-0000-0000-000000000001') THEN '  ✅' ELSE '  ❌' END
  FROM public.seoul_monitoring_records;
RESET ROLE;

\echo ''
\echo '=== A2. 지원자2(S2) — 배정된 P2 만 보인다(P1 격리) ==='
SET ROLE authenticated;
SET request.jwt.claim.sub = 'ba000000-0000-0000-0000-0000000000a2';
SELECT '   A2a. 참여자 1명(P2)만: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌' END
  FROM public.participants;
SELECT '   A2b. ★P1 격리(안 보임): ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.participants WHERE id='ba100000-0000-0000-0000-000000000001';
RESET ROLE;

\echo ''
\echo '=== A3. 미배정 지원자(S3) — 아무 당사자도 못 본다 ==='
SET ROLE authenticated;
SET request.jwt.claim.sub = 'ba000000-0000-0000-0000-0000000000a3';
SELECT '   A3a. 참여자 0명: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.participants;
SELECT '   A3b. 모니터링 0건: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_monitoring_records;
RESET ROLE;

\echo ''
\echo '=== A4. 관리자 — 전체 열람(override) ==='
SET ROLE authenticated;
SET request.jwt.claim.sub = 'ba000000-0000-0000-0000-0000000000ad';
SELECT '   A4a. 참여자 P1·P2 모두: ' || count(*) ||
       CASE WHEN count(*)>=2 THEN '  ✅' ELSE '  ❌ 관리자가 막힘' END
  FROM public.participants WHERE id IN ('ba100000-0000-0000-0000-000000000001','ba100000-0000-0000-0000-000000000002');
SELECT '   A4b. 모니터링 P1·P2 모두: ' || count(*) ||
       CASE WHEN count(*)>=2 THEN '  ✅' ELSE '  ❌' END
  FROM public.seoul_monitoring_records
  WHERE participant_id IN ('ba100000-0000-0000-0000-000000000001','ba100000-0000-0000-0000-000000000002');
RESET ROLE;

\echo ''
\echo '=== 담당자 배정 스코핑 계약 끝 — 위 A1b·A2b·A3 가 핵심(교차 supporter 격리) ==='
