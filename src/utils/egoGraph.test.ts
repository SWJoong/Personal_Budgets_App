import { describe, it, expect } from 'vitest'
import {
  buildEgoGraph,
  nodeGroup,
  edgeDirection,
  type GraphNode,
  type GraphEdge,
} from './egoGraph'

/**
 * 관계망 ego-그래프 추출 골든 — GOAL축 관계망 시각화.
 * 설계: Plan&Source/goala_relationship_network_W.md. 순수 로직이라 DB·렌더 없이 못박는다.
 * 소스: v_seoul_graph_nodes(node_type·id·label) + v_seoul_graph_edges(from/to·한글 관계).
 *
 * ★ test-first(W)로 RED — src/utils/egoGraph.ts 미존재. U 가 구현하면 green.
 *
 * 핵심 불변식:
 *  (1) 한 사람(rootId)에서 도달 가능한 부분그래프만 추출(무향 BFS, maxDepth 로 경계).
 *      ★입력은 RLS 로 이미 스코프된 행이어야 한다 — buildEgoGraph 는 준 것만 잇는다(교차참여자 유입 방지는 RLS 책임).
 *  (2) 끊긴 노드·고아 엣지(끝점 노드 없음)는 제외.
 *  (3) nodeGroup(색)·edgeDirection(To/For) 은 순수 매핑.
 *  (4) 결정적 정렬(depth→id / from→to).
 */

const nodes: GraphNode[] = [
  { node_type: 'Participant', id: 'p1', label: '김지수' },
  { node_type: 'UtilizationPlan', id: 'pl1', label: '이용계획 (approved)' },
  { node_type: 'BudgetAllocation', id: 'al1', label: '예산 2,000,000원' },
  { node_type: 'ServiceUsage', id: 'u1', label: '2026-08-10 카페' },
  { node_type: 'ServiceProvider', id: 'pv1', label: '햇살카페' },
  { node_type: 'MonitoringRecord', id: 'mo1', label: '모니터링 2026-08-10' },
  { node_type: 'Proxy', id: 'px1', label: '아버지 (부)' },
  { node_type: 'Application', id: 'ap1', label: '접수 2026-05' },
  // 끊긴 다른 참여자(교차 유입 없어야) — RLS 로 원래 안 들어오지만 방어 확인
  { node_type: 'Participant', id: 'p2', label: '다른사람' },
  { node_type: 'ServiceUsage', id: 'u2', label: '남의 지출' },
]

const edges: GraphEdge[] = [
  { from_type: 'Participant', from_id: 'p1', edge_type: 'hasPlan', edge_label: '계획을 가진다', to_type: 'UtilizationPlan', to_id: 'pl1' },
  { from_type: 'UtilizationPlan', from_id: 'pl1', edge_type: 'allocatedAs', edge_label: '예산이 된다', to_type: 'BudgetAllocation', to_id: 'al1' },
  { from_type: 'BudgetAllocation', from_id: 'al1', edge_type: 'spentAs', edge_label: '집행된다', to_type: 'ServiceUsage', to_id: 'u1' },
  { from_type: 'ServiceUsage', from_id: 'u1', edge_type: 'atProvider', edge_label: '이용한다', to_type: 'ServiceProvider', to_id: 'pv1' },
  { from_type: 'MonitoringRecord', from_id: 'mo1', edge_type: 'confirms', edge_label: '확인한다', to_type: 'ServiceUsage', to_id: 'u1' },
  { from_type: 'Proxy', from_id: 'px1', edge_type: 'actsFor', edge_label: '대리한다', to_type: 'Participant', to_id: 'p1' },
  { from_type: 'Participant', from_id: 'p1', edge_type: 'submits', edge_label: '신청한다', to_type: 'Application', to_id: 'ap1' },
  // 고아 엣지: 끝점(ghost) 노드가 목록에 없음 → 무시
  { from_type: 'Participant', from_id: 'p1', edge_type: 'hasGhost', edge_label: '유령', to_type: 'Ghost', to_id: 'ghost1' },
  // 다른 참여자 서브그래프(p1 과 연결 안 됨) → 제외
  { from_type: 'Participant', from_id: 'p2', edge_type: 'hasUsage', edge_label: '지출', to_type: 'ServiceUsage', to_id: 'u2' },
]

describe('nodeGroup — 노드 타입 → 색 그룹', () => {
  it('타입별 그룹 매핑', () => {
    expect(nodeGroup('Participant')).toBe('person')
    expect(nodeGroup('UtilizationPlan')).toBe('cycle')
    expect(nodeGroup('BudgetAllocation')).toBe('money')
    expect(nodeGroup('ServiceUsage')).toBe('money')
    expect(nodeGroup('MonitoringRecord')).toBe('eval')
    expect(nodeGroup('ServiceProvider')).toBe('asset')
    expect(nodeGroup('Proxy')).toBe('for')
    expect(nodeGroup('Caseworker')).toBe('for')
    expect(nodeGroup('무엇이든')).toBe('other')
  })
})

describe('edgeDirection — To/For 판정(주도성)', () => {
  it('당사자가 한 것 = by, 남이 대신 = for, 구조적 = neutral', () => {
    expect(edgeDirection('submits')).toBe('by') // 당사자가 신청
    expect(edgeDirection('grants')).toBe('by') // 당사자가 동의
    expect(edgeDirection('actsFor')).toBe('for') // 대리인이 대신
    expect(edgeDirection('cosigns')).toBe('for')
    expect(edgeDirection('decidedBy')).toBe('for')
    expect(edgeDirection('hasPlan')).toBe('neutral')
    expect(edgeDirection('allocatedAs')).toBe('neutral')
  })
})

describe('buildEgoGraph — 당사자 부분그래프 추출', () => {
  it('rootId 미존재 → 빈 그래프(방어)', () => {
    const g = buildEgoGraph(nodes, edges, 'nope')
    expect(g.nodes).toEqual([])
    expect(g.edges).toEqual([])
  })

  it('도달 가능한 노드만·깊이 부여, 끊긴 다른 참여자 제외', () => {
    const g = buildEgoGraph(nodes, edges, 'p1', 4)
    const ids = g.nodes.map((n) => n.id).sort()
    // p1 에서 도달: pl1·al1·u1·pv1·mo1·px1·ap1. p2·u2 는 제외(연결 없음).
    expect(ids).toEqual(['al1', 'ap1', 'mo1', 'p1', 'pl1', 'pv1', 'px1', 'u1'])
    expect(ids).not.toContain('p2')
    expect(ids).not.toContain('u2')
    const depth = Object.fromEntries(g.nodes.map((n) => [n.id, n.depth]))
    expect(depth['p1']).toBe(0)
    expect(depth['pl1']).toBe(1)
    expect(depth['px1']).toBe(1) // 대리인 → 참여자(무향) 이라 1
    expect(depth['ap1']).toBe(1)
    expect(depth['al1']).toBe(2)
    expect(depth['u1']).toBe(3)
    expect(depth['pv1']).toBe(4)
    expect(depth['mo1']).toBe(4) // mo1 → u1(3) → +1
  })

  it('maxDepth 로 경계를 둔다', () => {
    const g = buildEgoGraph(nodes, edges, 'p1', 1)
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['ap1', 'p1', 'pl1', 'px1']) // 직접 이웃만
  })

  it('고아 엣지(끝점 노드 없음)와 서브그래프 밖 엣지는 제외', () => {
    const g = buildEgoGraph(nodes, edges, 'p1', 4)
    // hasGhost(→ghost1 없음)·p2 hasUsage 는 결과 엣지에 없음
    expect(g.edges.some((e) => e.edge_type === 'hasGhost')).toBe(false)
    expect(g.edges.some((e) => e.from_id === 'p2')).toBe(false)
    // 포함된 엣지는 양 끝점이 모두 추출된 노드
    const idset = new Set(g.nodes.map((n) => n.id))
    expect(g.edges.every((e) => idset.has(e.from_id) && idset.has(e.to_id))).toBe(true)
  })

  it('엣지에 To/For 방향을 붙인다', () => {
    const g = buildEgoGraph(nodes, edges, 'p1', 4)
    const byType = Object.fromEntries(g.edges.map((e) => [e.edge_type, e.direction]))
    expect(byType['submits']).toBe('by')
    expect(byType['actsFor']).toBe('for')
    expect(byType['hasPlan']).toBe('neutral')
  })

  it('결정적 정렬(노드 depth→id, 엣지 from→to)', () => {
    const a = buildEgoGraph(nodes, edges, 'p1', 4)
    const b = buildEgoGraph([...nodes].reverse(), [...edges].reverse(), 'p1', 4)
    expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id))
    expect(a.edges.map((e) => e.from_id + '>' + e.to_id)).toEqual(b.edges.map((e) => e.from_id + '>' + e.to_id))
  })
})
