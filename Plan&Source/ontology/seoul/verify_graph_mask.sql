-- =====================================================================
-- 검증 · 그래프 노드 사람-이름 스코핑 (§1-4, test-first 계약)
--
-- 스펙: Plan&Source/goala_privacy_deid_assignment_W.md §1-4
--
-- ★재정합 노트(실 W): §1-4 원안은 "미배정 뷰어에게 person 라벨을 '○○님'으로 마스킹" 이었으나,
--   실측 결과 v_seoul_graph_nodes 는 WITH (security_invoker=true) 라 person 노드가 이미 RLS 로
--   **필터**된다(마스킹보다 강함 — 남의 참여자 person 노드는 이름은커녕 행 자체가 안 나온다).
--     · Participant 노드: participants RLS = seoul_can_access(id)
--     · Proxy 노드:       seoul_proxies RLS = seoul_can_access(participant_id)
--     · Caseworker 노드:  profiles_select 로 실무자·관리자 이름은 **의도적 공개**(직원 명단) — 마스킹 대상 아님.
--   따라서 별도 마스킹 로직·뷰 수정은 불필요. 이 파일은 그 필터 동작(교차 참여자 person 노드 차단)을
--   회귀로부터 잠근다. 기존 메커니즘에 대해 **GREEN 이어야 정상**(스코핑 작동 실증).
--
-- 실행: verify_02_rls/03_graph 와 동일(임시 PostgreSQL 또는 대시보드 SQL Editor).
--        auth stub → seoul 00~05 적용 뒤 이 파일. 자체 시드(cf* 프리픽스)로 자기 것만 본다.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── 시드: 배정 supporter · 미배정 supporter · 관리자 + 당사자 P(배정) + P의 대리인(Proxy) ──────
INSERT INTO auth.users (id, email) VALUES
  ('cf000000-0000-0000-0000-0000000000a1','gm-assigned@test.local'),
  ('cf000000-0000-0000-0000-0000000000a2','gm-unassigned@test.local'),
  ('cf000000-0000-0000-0000-0000000000ad','gm-admin@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('cf000000-0000-0000-0000-0000000000a1','supporter','배정지원자'),
  ('cf000000-0000-0000-0000-0000000000a2','supporter','미배정지원자'),
  ('cf000000-0000-0000-0000-0000000000ad','admin','관리자')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, name=EXCLUDED.name;

-- 당사자 P 는 '배정지원자'(a1)에게 배정. '미배정지원자'(a2)에게는 배정 안 됨.
INSERT INTO public.participants (id, name, assigned_supporter_id) VALUES
  ('cf100000-0000-0000-0000-000000000001','비밀당사자','cf000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO UPDATE SET assigned_supporter_id=EXCLUDED.assigned_supporter_id;

-- P 의 대리인(사람 이름을 담은 또 다른 person 노드).
INSERT INTO public.seoul_proxies (id, participant_id, proxy_name, relation_to_participant) VALUES
  ('cf200000-0000-0000-0000-000000000001','cf100000-0000-0000-0000-000000000001','비밀보호자','부')
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '=== M1. 배정 supporter — 배정된 당사자의 person 노드가 보인다(양성) ==='
SET ROLE authenticated;
SET request.jwt.claim.sub = 'cf000000-0000-0000-0000-0000000000a1';
SELECT '   Participant 노드(비밀당사자): ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅ 보임' ELSE '  ❌' END
  FROM public.v_seoul_graph_nodes WHERE node_type='Participant' AND id='cf100000-0000-0000-0000-000000000001';
SELECT '   Proxy 노드(비밀보호자): ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅ 보임' ELSE '  ❌' END
  FROM public.v_seoul_graph_nodes WHERE node_type='Proxy' AND id='cf200000-0000-0000-0000-000000000001';
RESET ROLE;

\echo ''
\echo '=== M2. ★미배정 supporter — person 노드가 이름은커녕 행 자체가 안 보인다(마스킹 대신 필터) ==='
SET ROLE authenticated;
SET request.jwt.claim.sub = 'cf000000-0000-0000-0000-0000000000a2';
SELECT '   Participant 노드(비밀당사자): ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 필터됨(이름 안 새어나감)' ELSE '  ❌ 새어나감' END
  FROM public.v_seoul_graph_nodes WHERE node_type='Participant' AND id='cf100000-0000-0000-0000-000000000001';
SELECT '   Proxy 노드(비밀보호자): ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 필터됨' ELSE '  ❌ 새어나감' END
  FROM public.v_seoul_graph_nodes WHERE node_type='Proxy' AND id='cf200000-0000-0000-0000-000000000001';
SELECT '   (참고) Caseworker(실무자) 노드: ' || count(*) ||
       '건 — 실무자 이름은 의도적 공개 명단(profiles_select), 마스킹 대상 아님'
  FROM public.v_seoul_graph_nodes WHERE node_type='Caseworker';
RESET ROLE;

\echo ''
\echo '=== M3. 관리자 — 전체 person 노드 열람(override) ==='
SET ROLE authenticated;
SET request.jwt.claim.sub = 'cf000000-0000-0000-0000-0000000000ad';
SELECT '   Participant+Proxy 노드: ' || count(*) ||
       CASE WHEN count(*)>=2 THEN '  ✅ 전체 보임' ELSE '  ❌ 관리자가 막힘' END
  FROM public.v_seoul_graph_nodes
 WHERE id IN ('cf100000-0000-0000-0000-000000000001','cf200000-0000-0000-0000-000000000001');
RESET ROLE;

\echo ''
\echo '=== 그래프 노드 person 스코핑 계약 끝 — M2 가 핵심(미배정 뷰어에게 person 노드 차단) ==='
