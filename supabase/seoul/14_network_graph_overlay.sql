-- =====================================================================
-- 14 · 관계망 그래프 오버레이 (큐레이션 뷰 + provenance)  —  Track B · B4  —  U(backend) 구현
--
--      설계권위: Plan&Source/goala_relationship_network_crud_W.md §2 B4
--                Plan&Source/goala_relationship_network_focus_W.md §1 (#5 관계·활동 중심)
--      계약:     Plan&Source/ontology/seoul/verify_network_graph_overlay.sql (S5~S7)
--                src/utils/egoGraph.overlay.test.ts
--
-- 모델: "파생그래프 + 수동 큐레이션"(사용자 승인). 읽기전용 파생 그래프(05_seoul_graph 의
--       v_seoul_graph_nodes/edges)는 **건드리지 않는다**. 대신 여기서 신규 큐레이션 뷰 2개가
--       파생 그래프 ∪ 실무자가 수동 입력한 사회 관계(seoul_network_entities, 13)를 UNION 하고,
--       각 엣지에 provenance(source: derived/manual)를 스탬프한다.
-- #5:  엣지뷰 말미에 relation_category(4분면)·closeness(친밀도) 두 컬럼을 **추가**한다 —
--       manual 엣지는 seoul_network_entities 값, derived 엣지는 NULL(파생 청결). 클라이언트가
--       '지역사회 위주' 강조·4분면 칩을 그리는 근거. CREATE OR REPLACE VIEW 는 기존 컬럼
--       순서·이름·타입 불변 + 말미 추가만 허용 → 안전(멱등).
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
-- #5: 말미 relation_category·closeness — derived 는 NULL(청결), manual 은 network_entities 값.
--     UNION ALL 컬럼명·타입은 첫 SELECT(derived) 기준 → NULL 을 ::TEXT/::INT 로 캐스팅해 고정.
CREATE OR REPLACE VIEW public.v_seoul_graph_edges_curated WITH (security_invoker = true) AS
  SELECT s_type, s_id, predicate, predicate_ko, o_type, o_id, 'derived'::TEXT AS source,
         NULL::TEXT AS relation_category, NULL::INT AS closeness
    FROM public.v_seoul_graph_edges
  UNION ALL
  SELECT 'Participant'::TEXT AS s_type, participant_id AS s_id,
         'hasNetworkEntity'::TEXT AS predicate,
         COALESCE(NULLIF(relation_type, ''), '관계')::TEXT AS predicate_ko,
         'NetworkEntity'::TEXT AS o_type, id AS o_id, 'manual'::TEXT AS source,
         relation_category, closeness
    FROM public.seoul_network_entities;

COMMENT ON VIEW public.v_seoul_graph_edges_curated IS
  '큐레이션 엣지뷰 = 파생 엣지(source=derived) ∪ 수동 관계(Participant→NetworkEntity, predicate=hasNetworkEntity, source=manual). #5: relation_category(4분면)·closeness(친밀도) 말미 추가 — manual 만 값, derived 는 NULL. security_invoker 로 base+network_entities RLS 유지.';
