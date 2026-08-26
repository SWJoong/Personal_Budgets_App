import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { buildDomainAxisReport, axisStatusLabel, type AxisStatus } from '@/utils/domainAxisReport'

/**
 * 지원영역 흐름 리포트 (GOAL축 B 교차집계) — 도메인별로 사정한 욕구 ↔ 실제 지출을 나란히.
 * 지출은 기존 뷰 v_seoul_domain_flow(도메인별 집계) 재활용, 사정은 seoul_needs_assessment.
 */

const STATUS_STYLE: Record<AxisStatus, { badge: string; emoji: string }> = {
  ok: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', emoji: '✅' },
  unmet: { badge: 'bg-amber-50 text-amber-700 ring-amber-200', emoji: '⚠️' },
  unplanned: { badge: 'bg-sky-50 text-sky-700 ring-sky-200', emoji: '📌' },
  none: { badge: 'bg-zinc-100 text-zinc-500 ring-zinc-200', emoji: '·' },
}

function won(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

export const metadata = { title: '월간 보고서' }

export default async function DomainAxisReportPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  const [{ data: domains }, { data: flow }, { data: needs }] = await Promise.all([
    supabase.from('seoul_service_domains').select('id, label, sort_order').eq('program', 'seoul'),
    supabase.from('v_seoul_domain_flow').select('*').eq('participant_id', participantId),
    supabase.from('seoul_needs_assessment').select('domain_id').eq('participant_id', participantId),
  ])

  const rows = buildDomainAxisReport(domains ?? [], flow ?? [], needs ?? [])
  const totalNeeds = rows.reduce((sum, r) => sum + r.needsCount, 0)
  const totalUsage = rows.reduce((sum, r) => sum + r.usageSum, 0)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href={`/supporter/${participantId}/assessment`}
          aria-label="뒤로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight">{participant.name}님의 지원영역 흐름</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-4">
        <p className="text-sm text-zinc-500 leading-relaxed">
          지원영역별로 <b className="text-zinc-700">사정한 욕구</b>와 <b className="text-zinc-700">실제 지출</b>을 나란히 봅니다.
          욕구는 있는데 아직 안 쓴 영역(⚠️)이나 사정 없이 지출된 영역(📌)을 살펴보세요.
        </p>

        <div className="flex gap-2">
          <div className="flex-1 p-3 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200">
            <div className="text-xs text-zinc-400">사정한 욕구</div>
            <div className="text-lg font-bold">{totalNeeds}건</div>
          </div>
          <div className="flex-1 p-3 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200">
            <div className="text-xs text-zinc-400">전체 지출</div>
            <div className="text-lg font-bold">{won(totalUsage)}</div>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const s = STATUS_STYLE[r.status]
            return (
              <li key={r.domainId} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-zinc-800">{r.label}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${s.badge}`}>
                    {s.emoji} {axisStatusLabel(r.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                  <span>
                    <span className="text-zinc-400">욕구 </span>
                    {r.needsCount}건
                  </span>
                  <span>
                    <span className="text-zinc-400">지출 </span>
                    {won(r.usageSum)}
                    {r.usageCount ? ` (${r.usageCount}건)` : ''}
                  </span>
                  {r.unplannedSum > 0 && (
                    <span className="text-sky-600">
                      <span className="text-zinc-400">계획 밖 </span>
                      {won(r.unplannedSum)}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
