-- =====================================================================
-- 검증 — 관계망 그래프 오버레이 (큐레이션 뷰 + provenance) (Track B · B4)
--
-- 설계출처: Plan&Source/goala_relationship_network_crud_W.md §2 B4
-- 배경: 읽기전용 파생 그래프(v_seoul_graph_*, 05) 위에 실무자가 수동 큐레이션한 사회 관계
--       (seoul_network_entities, 13)를 겹쳐 보여준다. 05 를 건드리지 않고 신규 큐레이션 뷰
--       (14_network_graph_overlay.sql)가 base 뷰 + network_entities 를 source(derived/manual)와
--       함께 UNION 한다. security_invoker 라 base(각 RLS)+network_entities(staff-only) 인가 유지.
--
-- 확인 항목
--   T0. 큐레이션 뷰 v_seoul_graph_{nodes,edges}_curated 존재 (구현 전이면 RED)
--   S1. 담당 실무자: 수동 관계 엣지가 source='manual' 로 뜬다
--   S2. 담당 실무자: 파생 엣지(대리인 등)가 source='derived' 로 뜬다
--   S3. 담당 실무자: 관계망 노드(NetworkEntity)가 큐레이션 노드뷰에 뜬다
--   S4. ★유출 차단: 남(다른 참여자)은 A 의 수동 관계 엣지를 못 본다(network_entities staff-only)
--   S5. [#5] manual 엣지에 relation_category(4분면)·closeness(친밀도) 가 노출된다(가족·1)
--   S6. [#5] manual 지역사회 엣지가 relation_category='community' 로 뜬다(지역사회 위주 필터 근거)
--   S7. [#5] ★provenance 청결: derived 엣지엔 relation_category·closeness 가 NULL(수동 메타 오염 없음)
--
-- ID 접두: 'fa' (hex·다른 verify 와 충돌 회피).
-- 실행 순서: verify_00_auth_stub → supabase/seoul/00,01,02,03,04,05,13,14 → 이 파일.
-- CI: db-verify.yml verify 배열에 verify_network_graph_overlay 등록 필요.
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
  ('faaaaaaa-0000-0000-0000-0000000000a1','ov-a-login@test.local'),
  ('fabbbbbb-0000-0000-0000-0000000000b1','ov-b-login@test.local'),
  ('fa000000-0000-0000-0000-0000000000ff','ov-staff@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('faaaaaaa-0000-0000-0000-0000000000a1','participant','오버레이당사자A'),
  ('fabbbbbb-0000-0000-0000-0000000000b1','participant','오버레이당사자B'),
  ('fa000000-0000-0000-0000-0000000000ff','supporter','오버레이실무자')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('fa111111-1111-1111-1111-111111111111','오버레이당사자A',
     'faaaaaaa-0000-0000-0000-0000000000a1','fa000000-0000-0000-0000-0000000000ff'),
  ('fa222222-2222-2222-2222-222222222222','오버레이당사자B',
     'fabbbbbb-0000-0000-0000-0000000000b1','fa000000-0000-0000-0000-0000000000ff')
ON CONFLICT (id) DO NOTHING;

-- A 의 수동 관계 2명(가족·지역사회) — 소유자/superuser 권한(RLS 우회).
-- #5: 가족(closeness 1)·지역사회(closeness 3) → S5/S6 분면·친밀도 노출, S7 파생 청결 대조.
INSERT INTO public.seoul_network_entities
  (id, participant_id, relation_category, entity_name, relation_type, closeness, created_by)
VALUES
  ('fa700000-0000-0000-0000-0000000000a1','fa111111-1111-1111-1111-111111111111',
   'family','김엄마','엄마',1,'fa000000-0000-0000-0000-0000000000ff'),
  ('fa700000-0000-0000-0000-0000000000c1','fa111111-1111-1111-1111-111111111111',
   'community','동네 주민센터','복지사',3,'fa000000-0000-0000-0000-0000000000ff')
ON CONFLICT (id) DO NOTHING;

-- A 의 대리인 1명 — 파생 엣지(Proxy actsFor Participant) 생성용.
INSERT INTO public.seoul_proxies (id, participant_id, proxy_name, relation_to_participant)
VALUES ('fa800000-0000-0000-0000-0000000000a1','fa111111-1111-1111-1111-111111111111','박대리','후견인')
ON CONFLICT (id) DO NOTHING;

\echo '=== T0. 큐레이션 뷰 존재 (구현 전이면 RED) ==='
SELECT '   T0a. v_seoul_graph_nodes_curated: ' ||
       CASE WHEN to_regclass('public.v_seoul_graph_nodes_curated') IS NOT NULL THEN '✅' ELSE '❌ 없음(구현 대기)' END;
SELECT '   T0b. v_seoul_graph_edges_curated: ' ||
       CASE WHEN to_regclass('public.v_seoul_graph_edges_curated') IS NOT NULL THEN '✅' ELSE '❌ 없음(구현 대기)' END;

\echo ''
\echo '=== 담당 실무자 — 파생+수동이 겹쳐 보인다 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'fa000000-0000-0000-0000-0000000000ff';
\echo '── S1. 수동 관계 엣지가 source=manual 로'
SELECT '   A→관계망 manual 엣지: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 수동엣지 누락' END
  FROM public.v_seoul_graph_edges_curated
 WHERE s_id='fa111111-1111-1111-1111-111111111111'
   AND o_id='fa700000-0000-0000-0000-0000000000a1' AND source='manual';
\echo '── S2. 파생 엣지가 source=derived 로(대리인 등)'
SELECT '   A 관련 derived 엣지: ' || count(*) ||
       CASE WHEN count(*)>=1 THEN '  ✅' ELSE '  ❌ 파생엣지에 source 누락' END
  FROM public.v_seoul_graph_edges_curated
 WHERE source='derived'
   AND (s_id='fa111111-1111-1111-1111-111111111111' OR o_id='fa111111-1111-1111-1111-111111111111');
\echo '── S3. 관계망 노드가 큐레이션 노드뷰에'
SELECT '   NetworkEntity 노드: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 노드 누락' END
  FROM public.v_seoul_graph_nodes_curated
 WHERE id='fa700000-0000-0000-0000-0000000000a1' AND node_type='NetworkEntity';
RESET ROLE;

\echo ''
\echo '=== 남(당사자B) — A 의 수동 관계는 못 본다(staff-only) ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'fabbbbbb-0000-0000-0000-0000000000b1';
\echo '── S4. ★유출 차단: B 가 본 A 의 manual 엣지'
SELECT '   B 가 본 A manual 엣지: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 유출' END
  FROM public.v_seoul_graph_edges_curated
 WHERE s_id='fa111111-1111-1111-1111-111111111111' AND source='manual';
RESET ROLE;

\echo ''
\echo '=== [#5] provenance 메타(4분면·친밀도) — 담당 실무자 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'fa000000-0000-0000-0000-0000000000ff';
\echo '── S5. manual 가족 엣지에 relation_category=family·closeness=1 노출'
SELECT '   가족 엣지 category·closeness: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 분면/친밀도 누락(구현 대기)' END
  FROM public.v_seoul_graph_edges_curated
 WHERE o_id='fa700000-0000-0000-0000-0000000000a1' AND source='manual'
   AND relation_category='family' AND closeness=1;
\echo '── S6. manual 지역사회 엣지가 relation_category=community(지역사회 위주 필터 근거)'
SELECT '   지역사회 엣지 category: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ community 미노출(구현 대기)' END
  FROM public.v_seoul_graph_edges_curated
 WHERE o_id='fa700000-0000-0000-0000-0000000000c1' AND source='manual'
   AND relation_category='community' AND closeness=3;
\echo '── S7. ★provenance 청결: derived 엣지엔 분면·친밀도 NULL(수동 메타 오염 없음)'
SELECT '   분면/친밀도 붙은 derived 엣지(있으면 오염): ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 청결' ELSE '  ❌ 파생에 수동 메타 오염' END
  FROM public.v_seoul_graph_edges_curated
 WHERE source='derived' AND (relation_category IS NOT NULL OR closeness IS NOT NULL);
RESET ROLE;

\echo ''
\echo '=== 그래프 오버레이 계약 검증 끝 ==='
