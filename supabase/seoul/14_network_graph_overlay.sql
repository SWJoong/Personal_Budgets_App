-- =====================================================================
-- 14 · 관계망 그래프 오버레이 (큐레이션 뷰 + provenance)  —  Track B · B4  —  U(backend) 구현
--
--      설계권위: Plan&Source/goala_relationship_network_crud_W.md §2 B4
--      계약:     Plan&Source/ontology/seoul/verify_network_graph_overlay.sql
--                src/utils/egoGraph.overlay.test.ts
--
-- 모델: "파생그래프 + 수동 큐레이션"(사용자 승인). 읽기전용 파생 그래프(05_seoul_graph 의
--       v_seoul_graph_nodes/edges)는 **건드리지 않는다**. 대신 여기서 신규 큐레이션 뷰 2개가
--       파생 그래프 ∪ 실무자가 수동 입력한 사회 관계(seoul_network_entities, 13)를 UNION 하고,
--       각 엣지에 provenance(source: derived/manual)를 스탬프한다.
-- 유출: 두 뷰 모두 WITH (security_invoker = true) → base 뷰(각 RLS) + network_entities(staff-only RLS)
--       인가가 그대로 유지된다. 큐레이션 뷰 자체는 RLS 우회 경로가 아니다 — 유출 없음.
-- 멱등: CREATE OR REPLACE VIEW → 재실행 가능.
-- 의존: 05_seoul_graph.sql(v_seoul_graph_nodes/edges) · 13_network_entities.sql(seoul_network_entities).
-- =====================================================================

-- ── 큐레이션 노드뷰 = 파생 노드 ∪ 관계망 개체(NetworkEntity) ──
CREATE OR REPLACE VIEW public.v_seoul_graph_nodes_curated WITH (security_invoker = true) AS
  SELECT node_type, id, label FROM public.v_seoul_graph_nodes
  UNION ALL
  SELECT 'NetworkEntity'::TEXT AS node_type, id, entity_name AS label
    FROM public.seoul_network_entities;

COMMENT ON VIEW public.v_seoul_graph_nodes_curated IS
  '큐레이션 노드뷰 = 파생 그래프 노드(05) ∪ 수동 관계망 개체(13, node_type=NetworkEntity). security_invoker 로 base+network_entities RLS 유지.';

-- ── 큐레이션 엣지뷰 = 파생 엣지(source=derived) ∪ 수동 관계(source=manual) ──
CREATE OR REPLACE VIEW public.v_seoul_graph_edges_curated WITH (security_invoker = true) AS
  SELECT s_type, s_id, predicate, predicate_ko, o_type, o_id, 'derived'::TEXT AS source
    FROM public.v_seoul_graph_edges
  UNION ALL
  SELECT 'Participant'::TEXT AS s_type, participant_id AS s_id,
         'hasNetworkEntity'::TEXT AS predicate,
         COALESCE(NULLIF(relation_type, ''), '관계')::TEXT AS predicate_ko,
         'NetworkEntity'::TEXT AS o_type, id AS o_id, 'manual'::TEXT AS source
    FROM public.seoul_network_entities;

COMMENT ON VIEW public.v_seoul_graph_edges_curated IS
  '큐레이션 엣지뷰 = 파생 엣지(source=derived) ∪ 수동 관계(Participant→NetworkEntity, predicate=hasNetworkEntity, source=manual). security_invoker 로 base+network_entities RLS 유지.';
