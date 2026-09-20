import Link from 'next/link'
import { requireAdmin } from '@/utils/supabase/staff'
import { won } from '@/utils/won'
import {
  aggregateFunnel,
  aggregateExecution,
  aggregateMonthly,
  aggregateUnplanned,
  aggregateSettlement,
  monitoringCoverage,
  type PipelineRow,
  type BalanceRow,
  type MonthlyRow,
} from '@/utils/kpiAggregate'

export const metadata = { title: '사업 현황' }

/**
 * 관리자 사업 현황 KPI 대시보드 — 신청·선정·심의·배정(A) · 예산 집행(B) · 점검·정산·모니터링(C).
 * 설계: docs/release/14 P2(#12). 지표 정의 사용자 확정(A·B·C, D 자기주도성은 보류).
 *
 * requireAdmin + 각 뷰/테이블 RLS(admin 전체 통과)로 이중 게이트. 집계는 순수 함수(kpiAggregate)로 분리해
 * 테스트 가능(page 는 조회·표시만). 모니터링 이행률은 v1 = 최근 30일 기록 유무(기대주기 [기관결정] 전 안전판).
 */

function daysAgoISODate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

function StatTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-1 p-4 rounded-2xl ring-1 ${
        accent ? 'bg-card ring-primary' : 'bg-card ring-border'
      }`}
    >
      <span className="text-xs font-bold text-muted-foreground leading-relaxed">{label}</span>
      <span className={`text-2xl font-black tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground leading-relaxed">{hint}</span>}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-1 mt-2">
      {children}
    </h2>
  )
}

const MONITORING_WINDOW_DAYS = 30

export default async function AdminInsightsPage() {
  const { supabase } = await requireAdmin()
  const monitoringCutoff = daysAgoISODate(MONITORING_WINDOW_DAYS)

  const [
    { data: pipeline },
    { data: balance },
    { data: monthly },
    { data: unplanned },
    { count: ruleChecksPending },
    { data: usages },
    { data: monitoring },
    { count: totalParticipants },
  ] = await Promise.all([
    supabase
      .from('v_seoul_pipeline')
      .select(
        'participant_id, application_id, application_status, is_selected, plan_id, plan_status, review_decision, notified_on, allocation_id'
      ),
    supabase.from('v_seoul_budget_balance').select('allocated_amount, spent, remaining'),
    supabase
      .from('v_seoul_monthly_usage')
      .select('participant_id, month, monthly_ceiling, month_spent, exceeds_monthly_ceiling'),
    supabase.from('v_seoul_unplanned_usages').select('participant_id'),
    supabase.from('seoul_rule_checks').select('*', { count: 'exact', head: true }).eq('human_decision', 'pending'),
    supabase.from('seoul_service_usages').select('settlement_status'),
    supabase.from('seoul_monitoring_records').select('participant_id').gte('monitoring_date', monitoringCutoff),
    supabase.from('participants').select('*', { count: 'exact', head: true }),
  ])

  const funnel = aggregateFunnel((pipeline ?? []) as PipelineRow[])
  const exec = aggregateExecution((balance ?? []) as BalanceRow[])
  const month = aggregateMonthly((monthly ?? []) as MonthlyRow[])
  const unplan = aggregateUnplanned((unplanned ?? []) as { participant_id?: string | null }[])
  const settle = aggregateSettlement((usages ?? []) as { settlement_status?: string | null }[])
  const monCov = monitoringCoverage(
    ((monitoring ?? []) as { participant_id?: string | null }[]).map((m) => m.participant_id),
    totalParticipants ?? 0
  )

  const pct = (v: number | null) => (v == null ? '—' : `${v}%`)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/admin"
          aria-label="뒤로 가기"
          className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">사업 현황</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          사업 진행을 한눈에 봐요. 관리자만 볼 수 있어요.
        </p>

        {/* A. 신청 → 선정 → 심의 → 배정 */}
        <SectionHeading>신청 · 선정 · 심의 · 배정</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile label="신청 접수" value={`${funnel.applied}명`} />
          <StatTile label="선정" value={`${funnel.selected}명`} hint={`선정률 ${pct(funnel.selectionRatePct)}`} />
          <StatTile label="계획 수립" value={`${funnel.planned}건`} />
          <StatTile label="승인" value={`${funnel.approved}건`} />
          <StatTile label="예산 배정" value={`${funnel.allocated}명`} accent />
          <StatTile label="결과 통지" value={`${funnel.notified}건`} />
        </div>

        {/* B. 예산 집행 */}
        <SectionHeading>예산 집행</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile
            label="전체 집행률"
            value={pct(exec.executionPct)}
            hint={`${won(exec.totalSpent)} / ${won(exec.totalAllocated)}`}
            accent
          />
          <StatTile label="미집행 당사자" value={`${exec.unexecuted}명`} hint="배정됐으나 아직 안 씀" />
          <StatTile label="월 한도 초과" value={`${month.exceeded}명`} hint={`임박(90%+) ${month.nearLimit}명`} />
          <StatTile label="저집행(<30%)" value={`${exec.bands.low}명`} />
          <StatTile label="정상 집행" value={`${exec.bands.normal}명`} />
          <StatTile label="고집행(>90%)" value={`${exec.bands.high}명`} />
          <StatTile label="계획외 지출" value={`${unplan.count}건`} hint={`${unplan.participants}명`} />
        </div>

        {/* C. 점검 · 정산 · 모니터링 (슈퍼비전) */}
        <SectionHeading>점검 · 정산 · 모니터링</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile label="규칙 점검 대기" value={`${ruleChecksPending ?? 0}건`} accent={(ruleChecksPending ?? 0) > 0} />
          <StatTile label="정산 대기" value={`${settle.pending}건`} />
          <StatTile label="환수" value={`${settle.recovered}건`} hint={`반려 ${settle.rejected}건`} />
          <StatTile
            label="모니터링(최근 30일)"
            value={pct(monCov.pct)}
            hint={`${monCov.covered} / ${monCov.total}명`}
          />
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
          ※ 집행 구간 저/고 기준 30%·90%, 모니터링은 최근 {MONITORING_WINDOW_DAYS}일 기록 유무예요(기관 기대주기 확정 시 이행률로 바꿔요).
        </p>
      </main>
    </div>
  )
}
