import { describe, it, expect } from 'vitest'
import { buildEgoGraph, nodeGroup, type GraphNode, type GraphEdge } from './egoGraph'

/**
 * B4 관계망 그래프 오버레이 — provenance 전파 + NetworkEntity 그룹 골든 (W 레인).
 * 설계출처: Plan&Source/goala_relationship_network_crud_W.md §2 B4.
 * 구현 대상: src/utils/egoGraph.ts (GraphEdge 에 source 가산 · NODE_GROUP 에 NetworkEntity).
 *
 * 배경: 큐레이션 뷰가 파생(derived)/수동(manual) 엣지를 source 로 구분해 내려주면, ego-그래프도 그
 *   source 를 EgoEdge 로 전파해야 클라이언트(NetworkGraphClient)가 수동 관계를 다르게 그릴 수 있다.
 *   또 관계망 노드(NetworkEntity)는 'other' 폴백이 아니라 사람 그룹으로 색칠한다.
 *
 * RED 사유: nodeGroup('NetworkEntity')가 'other' 를 반환(=='person' 실패) · GraphEdge 에 source 필드가
 *   없어 EgoEdge.source 접근이 tsc 에러(contract-tsc-gate). 구현이 둘 다 더하면 초록.
 */

describe('egoGraph 오버레이 (B4)', () => {
  it("NetworkEntity 노드는 'person' 그룹(other 폴백 아님)", () => {
    expect(nodeGroup('NetworkEntity')).toBe('person')
  })

  it('GraphEdge.source 가 EgoEdge 로 전파된다(파생/수동 구분)', () => {
    const nodes: GraphNode[] = [
      { node_type: 'Participant', id: 'p-1', label: '당사자' },
      { node_type: 'NetworkEntity', id: 'ne-1', label: '김엄마' },
      { node_type: 'Proxy', id: 'px-1', label: '대리인' },
    ]
    const edges: GraphEdge[] = [
      { from_type: 'Participant', from_id: 'p-1', edge_type: 'hasNetworkEntity', edge_label: '엄마', to_type: 'NetworkEntity', to_id: 'ne-1', source: 'manual' },
      { from_type: 'Proxy', from_id: 'px-1', edge_type: 'actsFor', edge_label: '대리한다', to_type: 'Participant', to_id: 'p-1', source: 'derived' },
    ]
    const ego = buildEgoGraph(nodes, edges, 'p-1')
    const manual = ego.edges.find((e) => e.to_id === 'ne-1')
    const derived = ego.edges.find((e) => e.from_id === 'px-1')
    expect(manual?.source).toBe('manual')
    expect(derived?.source).toBe('derived')
  })

  // #5: 큐레이션 뷰(14 확장)가 manual 엣지에 실은 4분면(relation_category)·친밀도(closeness)를
  //   ego-그래프가 EgoEdge 로 그대로 전파해야 클라이언트가 '지역사회 위주' 강조·분면 칩을 그린다.
  //   RED 사유: GraphEdge 에 relation_category/closeness 필드가 없어 tsc 에러(contract-tsc-gate).
  it('GraphEdge 의 relation_category·closeness 가 EgoEdge 로 전파된다(4분면·친밀도)', () => {
    const nodes: GraphNode[] = [
      { node_type: 'Participant', id: 'p-1', label: '당사자' },
      { node_type: 'NetworkEntity', id: 'ne-c', label: '동네 주민센터' },
      { node_type: 'Proxy', id: 'px-1', label: '대리인' },
    ]
    const edges: GraphEdge[] = [
      {
        from_type: 'Participant', from_id: 'p-1', edge_type: 'hasNetworkEntity', edge_label: '복지사',
        to_type: 'NetworkEntity', to_id: 'ne-c', source: 'manual', relation_category: 'community', closeness: 3,
      },
      { from_type: 'Proxy', from_id: 'px-1', edge_type: 'actsFor', edge_label: '대리한다', to_type: 'Participant', to_id: 'p-1', source: 'derived' },
    ]
    const ego = buildEgoGraph(nodes, edges, 'p-1')
    const community = ego.edges.find((e) => e.to_id === 'ne-c')
    const derived = ego.edges.find((e) => e.from_id === 'px-1')
    expect(community?.relation_category).toBe('community')
    expect(community?.closeness).toBe(3)
    // 파생 엣지엔 분면·친밀도 없음(뷰 NULL → undefined).
    expect(derived?.relation_category).toBeUndefined()
    expect(derived?.closeness).toBeUndefined()
  })
})
