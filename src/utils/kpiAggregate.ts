/**
 * 관리자 KPI 집계 — 순수 함수(무 DB·무부수효과). 계약: src/utils/kpiAggregate.test.ts.
 * 설계: docs/release/14 P2(#12 축C 사업 진행 파악 집계 대시보드). 지표 정의는 사용자 확정(A·B·C, D 보류).
 *
 * 페이지(admin/insights/page.tsx)가 뷰·테이블에서 원시 행을 조회해 이 함수들로 집계한다.
 * 조회는 관리자 세션(RLS admin 전체 통과)이며, 이 모듈은 셈만 한다.
 * 금액 필드는 뷰가 numeric/text 로 줄 수 있어 num() 로 방어적 캐스팅한다.
 */

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

// ── A. 신청→선정→심의→배정 퍼널 (v_seoul_pipeline) ──────────────────────────────
export interface PipelineRow {
  participant_id?: string | null
  application_id?: string | null
  application_status?: string | null
  is_selected?: boolean | null
  plan_id?: string | null
  plan_status?: string | null
  review_decision?: string | null
  notified_on?: string | null
  allocation_id?: string | null
}

export interface FunnelResult {
  applied: number // 접수 이상(draft 제외)
  selected: number
  planned: number
  approved: number
  allocated: number
  notified: number
  selectionRatePct: number | null // selected / (selected + not_selected), 결정 없으면 null
  planStatusCounts: Record<string, number>
}

const APPLIED_STATUSES = new Set(['received', 'screening', 'selected', 'not_selected', 'withdrawn'])

/**
 * ★dedup 필수: v_seoul_pipeline 은 plan→review→notification 을 LEFT JOIN 하는데 이 조인들은 1:1 이 아니다
 * (계획 재심의 conditional→approved = review 2행, 재작성 계획 등 → 한 신청이 여러 행으로 fan-out).
 * 스키마상 UNIQUE 는 selection_decisions.application_id·budget_allocations.plan_id 뿐. 따라서 행 단위로
 * 세면 applied/selected/planned/approved/allocated 가 부풀 수 있다. → 애플리케이션/계획/배정 id 로 중복 제거해 센다.
 */
export function aggregateFunnel(rows: PipelineRow[]): FunnelResult {
  const apps = new Map<string, { status: string | null; selected: boolean }>() // 신청 단위
  const plans = new Set<string>()
  const approvedPlans = new Set<string>()
  const notifiedPlans = new Set<string>()
  const allocations = new Set<string>()
  const planStatusByPlan = new Map<string, string>() // 계획별 상태(계획 단위 분포용)

  for (const r of rows) {
    if (r.application_id) {
      const selected = r.is_selected === true || r.application_status === 'selected'
      const prev = apps.get(r.application_id)
      if (!prev) apps.set(r.application_id, { status: r.application_status ?? null, selected })
      else if (selected) prev.selected = true
    }
    if (r.plan_id) {
      plans.add(r.plan_id)
      if (r.plan_status) planStatusByPlan.set(r.plan_id, r.plan_status)
      if (r.review_decision === 'approved' || r.plan_status === 'approved') approvedPlans.add(r.plan_id)
      if (r.notified_on) notifiedPlans.add(r.plan_id)
    }
    if (r.allocation_id) allocations.add(r.allocation_id)
  }

  let applied = 0
  let selected = 0
  let notSelected = 0
  for (const a of apps.values()) {
    if (a.status && APPLIED_STATUSES.has(a.status)) applied += 1
    if (a.selected) selected += 1
    if (a.status === 'not_selected') notSelected += 1
  }

  const planStatusCounts: Record<string, number> = {}
  for (const s of planStatusByPlan.values()) planStatusCounts[s] = (planStatusCounts[s] ?? 0) + 1

  const decided = selected + notSelected
  const selectionRatePct = decided > 0 ? Math.round((1000 * selected) / decided) / 10 : null

  return {
    applied,
    selected,
    planned: plans.size,
    approved: approvedPlans.size,
    allocated: allocations.size,
    notified: notifiedPlans.size,
    selectionRatePct,
    planStatusCounts,
  }
}

// ── B. 예산 집행 (v_seoul_budget_balance) ──────────────────────────────────────
export interface BalanceRow {
  allocated_amount?: number | string | null
  spent?: number | string | null
  remaining?: number | string | null
}

export interface ExecutionResult {
  totalAllocated: number
  totalSpent: number
  executionPct: number | null // Σspent / Σallocated, 배정 0 이면 null
  bands: { low: number; normal: number; high: number } // 저<30% · 정상 · 고>90% (배정>0 기준)
  unexecuted: number // 배정>0 이나 spent=0
}

/** 집행 구간 임계값(사용자 확정 기본값): 저집행 <30% · 고집행 >90%. */
const LOW_BAND = 0.3
const HIGH_BAND = 0.9

export function aggregateExecution(rows: BalanceRow[]): ExecutionResult {
  let totalAllocated = 0
  let totalSpent = 0
  const bands = { low: 0, normal: 0, high: 0 }
  let unexecuted = 0

  for (const r of rows) {
    const allocated = num(r.allocated_amount)
    const spent = num(r.spent)
    totalAllocated += allocated
    totalSpent += spent
    if (allocated <= 0) continue // 배정 없는 행은 구간 분포에서 제외
    const ratio = spent / allocated
    if (spent === 0) unexecuted += 1
    if (ratio < LOW_BAND) bands.low += 1
    else if (ratio > HIGH_BAND) bands.high += 1
    else bands.normal += 1
  }

  const executionPct = totalAllocated > 0 ? Math.round((1000 * totalSpent) / totalAllocated) / 10 : null
  return { totalAllocated, totalSpent, executionPct, bands, unexecuted }
}

// ── B. 월 한도 (v_seoul_monthly_usage) — 참여자별 최신 월 기준 ───────────────────
export interface MonthlyRow {
  participant_id?: string | null
  month?: string | null
  monthly_ceiling?: number | string | null
  month_spent?: number | string | null
  exceeds_monthly_ceiling?: boolean | null
}

const NEAR_LIMIT = 0.9

/** 참여자별 최신 월만 남겨 초과·임박(90%+·미초과) 인원을 센다. */
export function aggregateMonthly(rows: MonthlyRow[]): { exceeded: number; nearLimit: number } {
  const latest = new Map<string, MonthlyRow>()
  for (const r of rows) {
    const pid = r.participant_id
    if (!pid) continue
    const prev = latest.get(pid)
    if (!prev || String(r.month ?? '') > String(prev.month ?? '')) latest.set(pid, r)
  }
  let exceeded = 0
  let nearLimit = 0
  for (const r of latest.values()) {
    const ceiling = num(r.monthly_ceiling)
    const spent = num(r.month_spent)
    if (r.exceeds_monthly_ceiling === true || (ceiling > 0 && spent > ceiling)) {
      exceeded += 1
    } else if (ceiling > 0 && spent / ceiling >= NEAR_LIMIT) {
      nearLimit += 1
    }
  }
  return { exceeded, nearLimit }
}

/** 계획외 지출(v_seoul_unplanned_usages) — 건수·해당 참여자 수. */
export function aggregateUnplanned(rows: { participant_id?: string | null }[]): {
  count: number
  participants: number
} {
  const pids = new Set<string>()
  for (const r of rows) if (r.participant_id) pids.add(r.participant_id)
  return { count: rows.length, participants: pids.size }
}

// ── C. 점검·정산·모니터링 ──────────────────────────────────────────────────────
/** 정산 상태 분포(seoul_service_usages.settlement_status). recovered = 환수. */
export function aggregateSettlement(rows: { settlement_status?: string | null }[]): {
  pending: number
  accepted: number
  rejected: number
  recovered: number
} {
  const out = { pending: 0, accepted: 0, rejected: 0, recovered: 0 }
  for (const r of rows) {
    const s = r.settlement_status
    if (s === 'pending' || s === 'accepted' || s === 'rejected' || s === 'recovered') out[s] += 1
  }
  return out
}

/** 모니터링 커버리지 — 최근 기간 모니터링 받은 당사자 / 전체(주기 무관 버전, v1). */
export function monitoringCoverage(
  monitoredParticipantIds: (string | null | undefined)[],
  totalParticipants: number,
): { covered: number; total: number; pct: number | null } {
  const covered = new Set(monitoredParticipantIds.filter((v): v is string => !!v)).size
  const pct = totalParticipants > 0 ? Math.round((1000 * covered) / totalParticipants) / 10 : null
  return { covered, total: totalParticipants, pct }
}
