'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type Cy from 'cytoscape'
import type { EgoGraph, NodeGroup, RelationCategory } from '@/utils/egoGraph'

/**
 * 관계망 렌더 — cytoscape(동적 import, 이 staff 전용 라우트에서만 로드=코드분할).
 * 설계 goala_relationship_network_W.md §4: 노드=group 색, 엣지=direction(To/For) 스타일, 순환 고리·To/For 토글.
 * cytoscape 는 브라우저 전용이라 useEffect 안에서 동적 import(SSR 회피).
 */

const GROUP_COLOR: Record<NodeGroup, string> = {
  person: '#6366f1', // 당사자(중심)
  cycle: '#3b82f6', // 신청·계획·심의
  money: '#22c55e', // 예산·지출·정산
  eval: '#f59e0b', // 모니터링·점검
  asset: '#14b8a6', // 제공기관·영역
  for: '#f43f5e', // 대리·담당(남이 대신)
  other: '#a1a1aa',
}
const GROUP_LABEL: Record<NodeGroup, string> = {
  person: '당사자',
  cycle: '신청·계획·심의',
  money: '예산·지출·정산',
  eval: '모니터링·점검',
  asset: '제공기관·영역',
  for: '대리·담당',
  other: '기타',
}
// 순환 고리(사정→계획→예산→지출→정산→평가) 강조 시 살려둘 그룹. 나머지는 디밍.
const CYCLE_CORE: ReadonlySet<NodeGroup> = new Set<NodeGroup>(['person', 'cycle', 'money', 'eval'])
// #5 관계·활동 중심: 살려둘 그룹 = 사람(당사자+사회관계)·활동처(제공기관·영역)·활동(예산·지출).
// 나머지(cycle 신청·심의 · eval 점검 · for 대리·담당 = 제도 워크플로)는 디밍(삭제 아님).
const ACTIVITY_CORE: ReadonlySet<NodeGroup> = new Set<NodeGroup>(['person', 'asset', 'money'])
// #5 4분면 라벨·정렬(고정). manual 엣지의 relation_category 별 칩.
const CATEGORY_ORDER: readonly RelationCategory[] = ['family', 'friend', 'paid_support', 'community']
const CATEGORY_LABEL: Record<RelationCategory, string> = {
  family: '가족',
  friend: '친구',
  paid_support: '유급지원',
  community: '지역사회',
}
const COMMUNITY_COLOR = '#0891b2' // 지역사회 강조(청록) — provenance 승격 대비 활동 관계 부각.
const MANUAL_COLOR = '#8b5cf6' // 직접 얹은 관계(보라) — 실선·굵게로 핵심 승격.

export default function NetworkGraphClient({ graph, participantName }: { graph: EgoGraph; participantName: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Cy.Core | null>(null)
  const [ready, setReady] = useState(false)
  const [cycleOnly, setCycleOnly] = useState(false)
  const [activityFocus, setActivityFocus] = useState(false)
  const [showDirection, setShowDirection] = useState(false)
  const [selected, setSelected] = useState<{ id: string; label: string; group: NodeGroup; ntype: string } | null>(null)

  const nodeLabelById = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n.label])), [graph])

  // 수동 큐레이션(직접 입력한 사회 관계) 엣지가 하나라도 있으면 승격 범례를 노출.
  const hasCurated = useMemo(() => graph.edges.some((e) => e.source === 'manual'), [graph])

  // #5 provenance 요약 — 실무자가 직접 얹은 관계(manual) vs 자동 연결(derived=나머지).
  const manualCount = useMemo(() => graph.edges.filter((e) => e.source === 'manual').length, [graph])
  const derivedCount = graph.edges.length - manualCount

  // #5 4분면 칩 — manual 엣지의 relation_category 별 개수(존재하는 분면만, 고정 순서).
  const categoryCounts = useMemo(() => {
    const counts = new Map<RelationCategory, number>()
    for (const e of graph.edges) {
      if (e.source === 'manual' && e.relation_category) {
        counts.set(e.relation_category, (counts.get(e.relation_category) ?? 0) + 1)
      }
    }
    return CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({ category: c, count: counts.get(c)! }))
  }, [graph])

  // #5 지역사회(community) 관계 존재 여부 — 범례 청록 스와치 노출.
  const hasCommunity = useMemo(() => graph.edges.some((e) => e.relation_category === 'community'), [graph])

  // 선택 노드에 붙은 관계(양방향) — 텍스트 요약용.
  const selectedRelations = useMemo(() => {
    if (!selected) return []
    return graph.edges
      .filter((e) => e.from_id === selected.id || e.to_id === selected.id)
      .map((e) => ({
        key: `${e.from_id}>${e.to_id}:${e.edge_type}`,
        from: nodeLabelById[e.from_id] ?? e.from_id,
        to: nodeLabelById[e.to_id] ?? e.to_id,
        label: e.edge_label,
        direction: e.direction,
      }))
  }, [selected, graph, nodeLabelById])

  // ── cytoscape 초기화 (graph 바뀔 때) ──────────────────────────────────
  useEffect(() => {
    let destroyed = false
    let cy: Cy.Core | null = null
    ;(async () => {
      const cytoscape = (await import('cytoscape')).default
      if (destroyed || !containerRef.current) return

      // #5 지역사회(community) manual 엣지의 상대 노드 id — 노드 링 강조용.
      const communityNodeIds = new Set(
        graph.edges.filter((e) => e.relation_category === 'community').map((e) => e.to_id),
      )

      const elements: Cy.ElementDefinition[] = [
        ...graph.nodes.map((n) => ({
          data: { id: n.id, label: n.label, group: n.group, depth: n.depth, ntype: n.node_type },
          // #5 지역사회 관계망 노드 = 청록 링(활동 관계 부각).
          classes: communityNodeIds.has(n.id) ? 'community-node' : undefined,
        })),
        ...graph.edges.map((e) => {
          // 수동 큐레이션(.curated)=직접 얹은 관계(실선·보라·승격). 지역사회(.community)=청록 부각.
          const cls: string[] = []
          if (e.source === 'manual') cls.push('curated')
          if (e.relation_category === 'community') cls.push('community')
          return {
            // data.source/target 는 cytoscape 예약키(엣지 양끝 노드) — provenance 는 별도 키로 싣는다.
            data: {
              id: `${e.from_id}>${e.to_id}:${e.edge_type}`,
              source: e.from_id,
              target: e.to_id,
              label: e.edge_label,
              direction: e.direction,
              provenance: e.source ?? 'derived',
            },
            classes: cls.length ? cls.join(' ') : undefined,
          }
        }),
      ]

      const style = [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'font-size': 11,
            'text-wrap': 'wrap',
            'text-max-width': '96px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            color: '#3f3f46',
            width: 38,
            height: 38,
            'border-width': 2,
            'border-color': '#ffffff',
            'background-color': '#a1a1aa',
          },
        },
        { selector: "node[group='person']", style: { 'background-color': GROUP_COLOR.person, width: 64, height: 64, 'font-size': 13, 'font-weight': 'bold' } },
        { selector: "node[group='cycle']", style: { 'background-color': GROUP_COLOR.cycle } },
        { selector: "node[group='money']", style: { 'background-color': GROUP_COLOR.money } },
        { selector: "node[group='eval']", style: { 'background-color': GROUP_COLOR.eval } },
        { selector: "node[group='asset']", style: { 'background-color': GROUP_COLOR.asset } },
        { selector: "node[group='for']", style: { 'background-color': GROUP_COLOR.for } },
        { selector: "node[group='other']", style: { 'background-color': GROUP_COLOR.other } },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#cbd5e1',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.9,
          },
        },
        // #5 provenance 승격: 수동 큐레이션(직접 얹은 관계) 엣지 = 실선·굵게(width 3)·보라.
        // 파생(회색 얇은) 대비 '핵심'으로 읽히게. (기존 점선 → 실선 승격.)
        {
          selector: 'edge.curated',
          style: {
            'line-style': 'solid',
            'line-color': MANUAL_COLOR,
            'target-arrow-color': MANUAL_COLOR,
            width: 3,
          },
        },
        // #5 지역사회(community) manual 엣지 = 청록: 활동·지역사회 관계를 전면 부각(curated 뒤라 색 우선).
        {
          selector: 'edge.community',
          style: {
            'line-color': COMMUNITY_COLOR,
            'target-arrow-color': COMMUNITY_COLOR,
          },
        },
        {
          selector: 'edge.show-label',
          style: {
            label: 'data(label)',
            'font-size': 9,
            color: '#52525b',
            'text-rotation': 'autorotate',
            'text-background-color': '#ffffff',
            'text-background-opacity': 1,
            'text-background-padding': 2,
          },
        },
        { selector: 'edge.diron[direction="by"]', style: { 'line-color': '#16a34a', 'target-arrow-color': '#16a34a', width: 3 } },
        { selector: 'edge.diron[direction="for"]', style: { 'line-color': '#e11d48', 'target-arrow-color': '#e11d48', 'line-style': 'dashed', width: 3 } },
        // #5 지역사회 관계망 노드 = 청록 링(활동 관계 부각). node:selected 가 뒤라 선택 시 검정 링이 우선.
        { selector: 'node.community-node', style: { 'border-color': COMMUNITY_COLOR, 'border-width': 4 } },
        { selector: 'node:selected', style: { 'border-color': '#18181b', 'border-width': 4 } },
        { selector: '.dimmed', style: { opacity: 0.12 } },
      ] as Cy.StylesheetStyle[]

      cy = cytoscape({
        container: containerRef.current,
        elements,
        style,
        layout: {
          name: 'concentric',
          concentric: (node: Cy.NodeSingular) => -(node.data('depth') as number), // depth 0(당사자)=중심
          levelWidth: () => 1,
          minNodeSpacing: 44,
          spacingFactor: 1.1,
          avoidOverlap: true,
          animate: false,
        } as Cy.LayoutOptions,
        wheelSensitivity: 0.2,
        maxZoom: 2.5,
        minZoom: 0.3,
      })

      cy.on('tap', 'node', (evt: Cy.EventObject) => {
        const n = evt.target as Cy.NodeSingular
        cy!.edges().removeClass('show-label')
        n.connectedEdges().addClass('show-label')
        setSelected({ id: n.id(), label: n.data('label'), group: n.data('group'), ntype: n.data('ntype') })
      })
      cy.on('tap', (evt: Cy.EventObject) => {
        if (evt.target === cy) {
          cy!.edges().removeClass('show-label')
          setSelected(null)
        }
      })

      cyRef.current = cy
      setReady(true)
    })()

    return () => {
      destroyed = true
      if (cy) cy.destroy()
      cyRef.current = null
      setReady(false)
    }
  }, [graph])

  // ── 토글: To/For 색 ───────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    if (showDirection) cy.edges().addClass('diron')
    else cy.edges().removeClass('diron')
  }, [showDirection, ready])

  // ── 토글: 디밍 오버레이(순환 고리만 · 관계·활동 중심) ─────────────────
  // 두 토글은 독립 오버레이 — 둘 다 켜지면 각자 디밍 집합의 합집합(삭제 아님, opacity 0.12).
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('dimmed')
    const dimByCore = (core: ReadonlySet<NodeGroup>) => {
      const nonCore = cy.nodes().filter((n: Cy.NodeSingular) => !core.has(n.data('group') as NodeGroup))
      nonCore.addClass('dimmed')
      nonCore.connectedEdges().addClass('dimmed')
    }
    if (cycleOnly) dimByCore(CYCLE_CORE)
    // 관계·활동 중심: 제도 절차(cycle·eval·for) 디밍, 사람·활동처·활동(person·asset·money) 유지.
    if (activityFocus) dimByCore(ACTIVITY_CORE)
  }, [cycleOnly, activityFocus, ready])

  // 키보드 접근(§8 ⑤) — cy 'tap' 은 마우스/터치 전용이라, 노드 목록 버튼이 이 함수로 tap 과 동일한
  // 선택을 수행한다: 상세 패널 설정 + 그래프에서 해당 노드 선택·연결 엣지 라벨·센터링(시각 동기화).
  const selectNode = (id: string) => {
    const node = graph.nodes.find((n) => n.id === id)
    if (!node) return
    setSelected({ id: node.id, label: node.label, group: node.group, ntype: node.node_type })
    const cy = cyRef.current
    if (!cy) return
    const el = cy.$id(id)
    cy.edges().removeClass('show-label')
    el.connectedEdges().addClass('show-label')
    cy.nodes().unselect()
    el.select()
    cy.animate({ center: { eles: el } }, { duration: 200 })
  }

  const toggleBtn = (active: boolean) =>
    `min-h-[44px] px-4 rounded-xl text-sm font-bold transition-colors ring-1 ${
      active ? 'bg-hero text-hero-foreground ring-hero' : 'bg-card text-muted-foreground ring-border hover:bg-muted-hover hover:text-foreground'
    }`

  return (
    <div className="flex flex-col gap-4">
      {/* 토글 */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setActivityFocus((v) => !v)} className={toggleBtn(activityFocus)} aria-pressed={activityFocus}>
          🫂 관계·활동 중심
        </button>
        <button type="button" onClick={() => setCycleOnly((v) => !v)} className={toggleBtn(cycleOnly)} aria-pressed={cycleOnly}>
          🔄 순환 고리만
        </button>
        <button type="button" onClick={() => setShowDirection((v) => !v)} className={toggleBtn(showDirection)} aria-pressed={showDirection}>
          🧭 누가 했나 (To·For)
        </button>
        <button
          type="button"
          onClick={() => cyRef.current?.fit(undefined, 30)}
          className="min-h-[44px] px-4 rounded-xl text-sm font-bold bg-card text-muted-foreground ring-1 ring-border hover:bg-muted-hover hover:text-foreground transition-colors ml-auto"
        >
          가운데 맞추기
        </button>
      </div>

      {activityFocus && (
        <p className="text-xs text-muted-foreground leading-relaxed px-1 -mt-1">
          제도 절차(신청·심의·대리)는 흐리게, 사람의 관계·활동을 앞으로 보여줘요. 노드는 지우지 않아요.
        </p>
      )}

      {/* #5 provenance 요약(항상 표시 — 텍스트 대안 겸). aria-live 밖: 매 렌더 재낭독 방지. */}
      <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card ring-1 ring-border">
        <p className="text-sm font-bold text-foreground leading-relaxed">
          실무자가 직접 얹은 관계 {manualCount}개 · 자동 연결 {derivedCount}개
        </p>
        {manualCount > 0 && categoryCounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categoryCounts.map(({ category, count }) => (
              <span
                key={category}
                className={`inline-flex items-center min-h-[32px] px-3 rounded-full text-xs font-bold ring-1 ${
                  category === 'community' ? 'bg-info-bg text-info-fg ring-info-fg/20' : 'bg-card text-muted-foreground ring-border'
                }`}
              >
                {CATEGORY_LABEL[category]} {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 그래프 */}
      <div
        ref={containerRef}
        role="img"
        aria-label={`${participantName}의 관계망 그림. 노드 ${graph.nodes.length}개, 관계 ${graph.edges.length}개.`}
        className="w-full rounded-2xl ring-1 ring-border bg-card"
        style={{ height: '60dvh', minHeight: 380 }}
      />

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground px-1">
        {(Object.keys(GROUP_LABEL) as NodeGroup[]).map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: GROUP_COLOR[g] }} />
            {GROUP_LABEL[g]}
          </span>
        ))}
        {showDirection && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: '#16a34a' }} />본인이 함(To)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: '#e11d48' }} />남이 대신(For)
            </span>
          </>
        )}
        {hasCurated && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-0.5" style={{ backgroundColor: MANUAL_COLOR }} />실선 = 직접 얹은 사회 관계
          </span>
        )}
        {hasCommunity && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-0.5" style={{ backgroundColor: COMMUNITY_COLOR }} />지역사회
          </span>
        )}
      </div>

      {/* 키보드로 노드 고르기(§8 ⑤) — cy tap 은 마우스/터치 전용이라, 이 목록 버튼이 노드 선택을
          대신한다. 그림은 시각 보조로 두고 키보드 사용자는 여기서 노드를 골라 아래 상세를 본다. */}
      <details className="rounded-2xl bg-muted ring-1 ring-border">
        <summary className="p-4 font-bold text-sm text-muted-foreground cursor-pointer select-none min-h-[44px] flex items-center">
          노드 골라 보기 ({graph.nodes.length})
        </summary>
        <ul className="flex flex-col gap-1 px-3 pb-3">
          {graph.nodes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => selectNode(n.id)}
                aria-pressed={selected?.id === n.id}
                className={`w-full flex items-center gap-2 px-3 min-h-[44px] rounded-lg text-sm text-left transition-colors ${
                  selected?.id === n.id ? 'bg-hero text-hero-foreground' : 'text-foreground hover:bg-muted-hover'
                }`}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: GROUP_COLOR[n.group] }} aria-hidden="true" />
                <span className="font-medium truncate">{n.label}</span>
                <span className={`text-xs ml-auto shrink-0 ${selected?.id === n.id ? 'text-hero-foreground/70' : 'text-muted-foreground'}`}>
                  {GROUP_LABEL[n.group]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </details>

      {/* 선택 노드 정보 — 노드 선택(마우스·키보드 공통) 결과. aria-live 로 SR 에 자동 안내(§8 ⑤). */}
      <div aria-live="polite">
      {selected && (
        <div className="p-4 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: GROUP_COLOR[selected.group] }} />
            <span className="font-bold text-foreground">{selected.label}</span>
            <span className="text-xs text-muted-foreground ml-auto">{GROUP_LABEL[selected.group]}</span>
          </div>
          {selectedRelations.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {selectedRelations.map((r) => (
                <li key={r.key} className="leading-relaxed">
                  <span className="text-muted-foreground">{r.from}</span>
                  {' — '}
                  <span className={r.direction === 'for' ? 'text-relation-for font-medium' : r.direction === 'by' ? 'text-relation-by font-medium' : 'text-foreground'}>
                    {r.label}
                  </span>
                  {' → '}
                  <span className="text-muted-foreground">{r.to}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>

      {/* 관계 목록(텍스트 대안 — 그림을 읽기 어려울 때) */}
      <details className="rounded-2xl bg-muted ring-1 ring-border">
        <summary className="p-4 font-bold text-sm text-muted-foreground cursor-pointer select-none min-h-[44px] flex items-center">
          관계 목록 보기 ({graph.edges.length})
        </summary>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground px-4 pb-4">
          {graph.edges.map((e) => (
            <li key={`${e.from_id}>${e.to_id}:${e.edge_type}`} className="leading-relaxed">
              <span className="text-muted-foreground">{nodeLabelById[e.from_id] ?? e.from_id}</span>
              {' — '}
              <span className="text-muted-foreground">{e.edge_label}</span>
              {' → '}
              <span className="text-muted-foreground">{nodeLabelById[e.to_id] ?? e.to_id}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
