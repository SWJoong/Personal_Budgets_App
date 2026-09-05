'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type Cy from 'cytoscape'
import type { EgoGraph, NodeGroup } from '@/utils/egoGraph'

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

export default function NetworkGraphClient({ graph, participantName }: { graph: EgoGraph; participantName: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Cy.Core | null>(null)
  const [ready, setReady] = useState(false)
  const [cycleOnly, setCycleOnly] = useState(false)
  const [showDirection, setShowDirection] = useState(false)
  const [selected, setSelected] = useState<{ id: string; label: string; group: NodeGroup; ntype: string } | null>(null)

  const nodeLabelById = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n.label])), [graph])

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

      const elements: Cy.ElementDefinition[] = [
        ...graph.nodes.map((n) => ({
          data: { id: n.id, label: n.label, group: n.group, depth: n.depth, ntype: n.node_type },
        })),
        ...graph.edges.map((e) => ({
          data: {
            id: `${e.from_id}>${e.to_id}:${e.edge_type}`,
            source: e.from_id,
            target: e.to_id,
            label: e.edge_label,
            direction: e.direction,
          },
        })),
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

  // ── 토글: 순환 고리만 강조(나머지 디밍) ───────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('dimmed')
    if (cycleOnly) {
      const nonCore = cy.nodes().filter((n: Cy.NodeSingular) => !CYCLE_CORE.has(n.data('group') as NodeGroup))
      nonCore.addClass('dimmed')
      nonCore.connectedEdges().addClass('dimmed')
    }
  }, [cycleOnly, ready])

  const toggleBtn = (active: boolean) =>
    `min-h-[44px] px-4 rounded-xl text-sm font-bold transition-colors ring-1 ${
      active ? 'bg-hero text-hero-foreground ring-hero' : 'bg-card text-muted-foreground ring-border hover:bg-muted'
    }`

  return (
    <div className="flex flex-col gap-4">
      {/* 토글 */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCycleOnly((v) => !v)} className={toggleBtn(cycleOnly)} aria-pressed={cycleOnly}>
          🔄 순환 고리만
        </button>
        <button type="button" onClick={() => setShowDirection((v) => !v)} className={toggleBtn(showDirection)} aria-pressed={showDirection}>
          🧭 누가 했나 (To·For)
        </button>
        <button
          type="button"
          onClick={() => cyRef.current?.fit(undefined, 30)}
          className="min-h-[44px] px-4 rounded-xl text-sm font-bold bg-card text-muted-foreground ring-1 ring-border hover:bg-muted transition-colors ml-auto"
        >
          가운데 맞추기
        </button>
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
      </div>

      {/* 선택 노드 정보 */}
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
