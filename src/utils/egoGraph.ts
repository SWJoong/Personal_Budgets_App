/**
 * 관계망 ego-그래프 추출 — 순수 로직(서버/클라이언트 공용, DB·렌더 무관, 테스트 가능).
 * 설계: Plan&Source/goala_relationship_network_W.md §3. 골든: egoGraph.test.ts.
 *
 * 개인예산 데이터는 표가 아니라 관계망이다. 한 사람(rootId)을 중심으로 사정→계획→예산→지출→정산→평가가
 * 하나의 순환 고리로 이어지고 제공기관·재원·대리인·담당자가 연결된다. 이 모듈은
 * v_seoul_graph_nodes/edges(입력)에서 rootId 에 연결된 부분그래프만 무향 BFS 로 추출하고,
 * 색 그룹(nodeGroup)·주도성(edgeDirection, To/For)을 붙인다.
 *
 * ★ 스코프 보안: buildEgoGraph 는 '준 것만' 잇는다. 교차참여자 유입 방지는 입력을 '보는 사용자 권한'으로
 *   SELECT(RLS)하는 호출부 책임 — 남의 지출·계획은 애초에 입력에 없어 BFS 가 남에게 건너가지 못한다.
 *   maxDepth 로 추가 경계를 둔다.
 */

/** v_seoul_graph_nodes 행. */
export interface GraphNode {
  node_type: string
  id: string
  label: string
}

/** v_seoul_graph_edges 행(edge_label 은 한글 관계명). */
export interface GraphEdge {
  from_type: string
  from_id: string
  edge_type: string
  edge_label: string
  to_type: string
  to_id: string
}

/** 색 그룹. */
export type NodeGroup = 'person' | 'cycle' | 'money' | 'eval' | 'asset' | 'for' | 'other'
/** 주도성(To/For) — 당사자가 함(by) / 남이 대신(for) / 구조적(neutral). */
export type EdgeDirection = 'by' | 'for' | 'neutral'

export interface EgoNode extends GraphNode {
  depth: number
  group: NodeGroup
}
export interface EgoEdge extends GraphEdge {
  direction: EdgeDirection
}
export interface EgoGraph {
  rootId: string
  nodes: EgoNode[]
  edges: EgoEdge[]
}

// 노드 타입 → 색 그룹 (설계 §3, 골든 고정).
const NODE_GROUP: Record<string, NodeGroup> = {
  Participant: 'person',
  // cycle — 순환 고리(신청·동의·선정·계획·자기서사·요청·심의·통지·이의). 설계 §3 "…" 범위:
  // v_seoul_graph_nodes 의 신청→선정→심의→통지→이의 흐름 개체를 모두 cycle 색으로.
  Application: 'cycle',
  ConsentRecord: 'cycle',
  SelectionDecision: 'cycle',
  UtilizationPlan: 'cycle',
  SelfNarrative: 'cycle',
  RequestedService: 'cycle',
  PlanReview: 'cycle',
  ReviewCommittee: 'cycle',
  Notification: 'cycle',
  Appeal: 'cycle',
  // money — 예산·지출·영수증·정산·재원
  BudgetAllocation: 'money',
  ServiceUsage: 'money',
  Receipt: 'money',
  Settlement: 'money',
  AdministeringBody: 'money',
  // eval — 모니터링·규칙점검
  MonitoringRecord: 'eval',
  RuleCheck: 'eval',
  SpendingRule: 'eval',
  // asset — 제공기관·영역
  ServiceProvider: 'asset',
  ServiceDomain: 'asset',
  // for — 남이 대신(대리인·담당자·집행기관)
  Proxy: 'for',
  Caseworker: 'for',
  ExecutingAgency: 'for',
}

/** 노드 타입 → 색 그룹. 미등록 타입은 'other'. */
export function nodeGroup(nodeType: string): NodeGroup {
  return NODE_GROUP[nodeType] ?? 'other'
}

// 엣지 타입 → 주도성(설계 §3). by=당사자가 함, for=남이 대신, 나머지=구조적(neutral).
const EDGE_BY = new Set(['submits', 'grants'])
const EDGE_FOR = new Set(['actsFor', 'cosigns', 'decidedBy'])

/** 엣지 타입 → To/For 주도성. */
export function edgeDirection(edgeType: string): EdgeDirection {
  if (EDGE_BY.has(edgeType)) return 'by'
  if (EDGE_FOR.has(edgeType)) return 'for'
  return 'neutral'
}

/**
 * rootId(당사자)에서 무향 BFS 로 도달 가능한 부분그래프를 추출한다.
 *  - rootId 가 노드에 없으면 빈 그래프(방어).
 *  - 고아 엣지(끝점 노드가 목록에 없음)는 인접에서 제외 → BFS 가 유령으로 새지 않는다.
 *  - depth ≤ maxDepth(기본 4) 인 노드만. 결과 엣지는 양 끝점이 모두 추출된 것만.
 *  - 결정적 정렬: 노드 depth→id, 엣지 from→to (입력 순서에 의존하지 않는 UI 결정성).
 */
export function buildEgoGraph(nodes: GraphNode[], edges: GraphEdge[], rootId: string, maxDepth = 4): EgoGraph {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  if (!byId.has(rootId)) return { rootId, nodes: [], edges: [] }

  // 무향 인접 리스트 — 양 끝점이 모두 존재하는 엣지만(고아 엣지 제외).
  const adj = new Map<string, string[]>()
  const addAdj = (a: string, b: string) => {
    const list = adj.get(a)
    if (list) list.push(b)
    else adj.set(a, [b])
  }
  for (const e of edges) {
    if (!byId.has(e.from_id) || !byId.has(e.to_id)) continue // 고아 엣지 무시
    addAdj(e.from_id, e.to_id)
    addAdj(e.to_id, e.from_id)
  }

  // 무향 BFS — 최단 무향 거리(depth), maxDepth 에서 확장 중단.
  const depthById = new Map<string, number>([[rootId, 0]])
  const queue: string[] = [rootId]
  while (queue.length) {
    const cur = queue.shift()!
    const d = depthById.get(cur)!
    if (d >= maxDepth) continue // 경계 — 이웃을 더 펼치지 않는다
    for (const nb of adj.get(cur) ?? []) {
      if (!depthById.has(nb)) {
        depthById.set(nb, d + 1)
        queue.push(nb)
      }
    }
  }

  // 추출 노드 — depth → id 결정적 정렬.
  const egoNodes: EgoNode[] = [...depthById.entries()]
    .map(([id, depth]) => {
      const n = byId.get(id)!
      return { ...n, depth, group: nodeGroup(n.node_type) }
    })
    .sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  // 추출 엣지 — 양 끝점이 모두 추출된 노드. from → to 결정적 정렬.
  const inGraph = new Set(depthById.keys())
  const egoEdges: EgoEdge[] = edges
    .filter((e) => inGraph.has(e.from_id) && inGraph.has(e.to_id))
    .map((e) => ({ ...e, direction: edgeDirection(e.edge_type) }))
    .sort(
      (a, b) =>
        (a.from_id < b.from_id ? -1 : a.from_id > b.from_id ? 1 : 0) ||
        (a.to_id < b.to_id ? -1 : a.to_id > b.to_id ? 1 : 0),
    )

  return { rootId, nodes: egoNodes, edges: egoEdges }
}
