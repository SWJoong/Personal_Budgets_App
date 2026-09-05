import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { buildEgoGraph, type GraphNode, type GraphEdge } from '@/utils/egoGraph'
import NetworkGraphClient from './NetworkGraphClient'

/**
 * 관계망 시각화 — 담당자·관리자 분석 도구. 설계: Plan&Source/goala_relationship_network_W.md.
 *
 * 한 당사자를 중심으로 사정→계획→예산→지출→정산→평가의 순환 고리와 제공기관·대리인·담당자를 그린다.
 * 소스는 v_seoul_graph_nodes/edges(이미 존재, security_invoker=true) — 사용자 권한으로 SELECT 하므로
 * RLS 가 접근 가능한 행만 넘긴다. buildEgoGraph 는 '준 것만' 잇고, rootId 연결 성분만 추출한다(교차참여자
 * 유입 방지는 RLS 책임 + maxDepth 경계). 뷰 컬럼(s_/o_/predicate)을 순수 로직 shape(GraphEdge)로 매핑한다.
 */
export const metadata = { title: '관계망' }

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ participant?: string }>
}) {
  const { supabase } = await requireStaff()
  const { participant: participantId } = await searchParams

  // 참여자 목록(피커) — RLS 스코프(담당자가 접근 가능한 당사자만).
  const { data: participants } = await supabase
    .from('participants')
    .select('id, name')
    .order('name', { ascending: true })

  const backHeader = (title: string, backHref: string, backLabel: string) => (
    <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
      >
        ←
      </Link>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
    </header>
  )

  // ── 참여자 미선택 → 피커 ──────────────────────────────────────────────
  if (!participantId) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        {backHeader('관계망 · 당사자 선택', '/supporter', '대시보드로 가기')}
        <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground leading-relaxed px-1">
            관계망을 볼 당사자를 골라 주세요. 한 사람의 신청·계획·예산·지출·평가가 어떻게 이어지는지 그림으로 보여줘요.
          </p>
          {(participants ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">아직 등록된 당사자가 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(participants ?? []).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/supporter/network?participant=${p.id}`}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-card ring-1 ring-border hover:bg-muted transition-colors min-h-[56px]"
                  >
                    <span className="font-bold truncate">{p.name ?? '이름 없음'}</span>
                    <span className="text-xs font-bold text-muted-foreground shrink-0">관계망 보기 →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    )
  }

  const selected = (participants ?? []).find((p) => p.id === participantId)

  // ── 그래프 소스 — 사용자 권한(RLS)으로 SELECT ─────────────────────────
  const [{ data: nodeRows }, { data: edgeRows }] = await Promise.all([
    supabase.from('v_seoul_graph_nodes').select('node_type, id, label'),
    supabase.from('v_seoul_graph_edges').select('s_type, s_id, predicate, predicate_ko, o_type, o_id'),
  ])

  // 뷰 컬럼 → 순수 로직 shape 매핑(널 endpoint 제외).
  const nodes: GraphNode[] = (nodeRows ?? [])
    .filter((n): n is { node_type: string; id: string; label: string | null } => !!n.id && !!n.node_type)
    .map((n) => ({ node_type: n.node_type, id: n.id, label: n.label ?? '(이름 없음)' }))
  const edges: GraphEdge[] = (edgeRows ?? [])
    .filter(
      (e): e is { s_type: string; s_id: string; predicate: string; predicate_ko: string | null; o_type: string; o_id: string } =>
        !!e.s_id && !!e.o_id && !!e.predicate && !!e.s_type && !!e.o_type,
    )
    .map((e) => ({
      from_type: e.s_type,
      from_id: e.s_id,
      edge_type: e.predicate,
      edge_label: e.predicate_ko ?? e.predicate,
      to_type: e.o_type,
      to_id: e.o_id,
    }))

  const graph = buildEgoGraph(nodes, edges, participantId)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center gap-3 px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/supporter/network"
          aria-label="다른 당사자 고르기"
          className="text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight truncate">
          {selected?.name ?? '당사자'} · 관계망
        </h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6">
        {graph.nodes.length === 0 ? (
          <div className="p-6 rounded-2xl bg-muted ring-1 ring-border text-center flex flex-col items-center gap-3">
            <span className="text-4xl">🕸️</span>
            <p className="text-muted-foreground leading-relaxed">
              아직 그릴 관계가 없어요.<br />신청·계획·지출이 쌓이면 여기에 이어져요.
            </p>
          </div>
        ) : (
          <NetworkGraphClient graph={graph} participantName={selected?.name ?? '당사자'} />
        )}
      </main>
    </div>
  )
}
