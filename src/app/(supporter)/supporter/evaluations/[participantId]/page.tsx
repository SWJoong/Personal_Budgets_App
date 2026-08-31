import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getMonitoringRecords } from '@/app/actions/monitoring'
import { getSettlements } from '@/app/actions/settlement'
import { getPlanReviews } from '@/app/actions/planReview'
import {
  buildEvaluationTimeline,
  type MonitoringRow,
  type SettlementRow,
  type PlanReviewRow,
} from '@/utils/evaluationTimeline'
import EvaluationClient from './EvaluationClient'

export const metadata = { title: '정산·평가' }

// 참여자 1인 통합 뷰(참여자 그레인). 모니터링·정산·심의를 로드해 buildEvaluationTimeline 으로
// 날짜순 타임라인을 만든다. 구 [month]·goals 서브라우트는 폐기(설계 §6) — 이 화면 하나로 통합.
export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ participantId: string }>
}) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()
  if (!participant) notFound()

  // 정산은 배정×기간 그레인이라 최신 배정 기준으로 로드(참여자 상세 화면과 동일 패턴).
  const { data: allocation } = await supabase
    .from('seoul_budget_allocations')
    .select('id')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [{ records }, { settlements }, { reviews }] = await Promise.all([
    getMonitoringRecords(participantId),
    allocation ? getSettlements(allocation.id) : Promise.resolve({ settlements: [] }),
    getPlanReviews(participantId),
  ])

  // DB(snake) → 타임라인 계약(camel) 매핑. observed/voice 는 분리 유지(섞지 않음).
  const monitoring: MonitoringRow[] = records.map((r) => ({
    id: r.id,
    monitoringDate: r.monitoring_date,
    method: r.method,
    observedChange: r.observed_change,
    participantVoice: r.participant_voice,
    allocationId: r.allocation_id,
  }))
  const settlementRows: SettlementRow[] = settlements.map((s) => ({
    id: s.id,
    allocationId: s.allocation_id,
    settledPeriod: s.settled_period,
    acceptedAmount: Number(s.accepted_amount),
    rejectedAmount: Number(s.rejected_amount),
    recoveredAmount: Number(s.recovered_amount),
    unusedAmount: Number(s.unused_amount),
  }))
  const reviewRows: PlanReviewRow[] = reviews.map((r) => ({
    id: r.id,
    decision: r.decision,
    reason: r.reason,
    reviewDate: r.review_date,
  }))

  const timeline = buildEvaluationTimeline(monitoring, settlementRows, reviewRows)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href="/supporter/evaluations"
          aria-label="뒤로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight">{participant.name}님의 정산·평가</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6">
        <EvaluationClient
          participantId={participant.id}
          allocationId={allocation?.id ?? null}
          timeline={timeline}
          monitoring={monitoring}
        />
      </main>
    </div>
  )
}
