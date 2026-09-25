/**
 * 월별 평가 — 순수 유틸(서버·클라 공용). 계약: src/utils/evaluation.test.ts.
 * 설계: supabase/seoul/20_evaluations.sql (사용자 결정 2026-09-25 — 당사자 평가=실무자 대필,
 * 계획 이행 정도=계획 항목별). 달 키는 'YYYY-MM'(DB CHECK 와 동일 형식).
 */

export type Achievement = 'not_achieved' | 'partial' | 'achieved' | 'exceeded'

/** 계획 항목 이행 정도 4단계 — 표시 순서 = 낮음→높음. */
export const ACHIEVEMENT_LEVELS: { value: Achievement; label: string }[] = [
  { value: 'not_achieved', label: '미이행' },
  { value: 'partial', label: '부분 이행' },
  { value: 'achieved', label: '이행' },
  { value: 'exceeded', label: '초과 달성' },
]

export function isAchievement(v: unknown): v is Achievement {
  return typeof v === 'string' && ACHIEVEMENT_LEVELS.some((l) => l.value === v)
}

/** 이행 정도 코드 → 한글. 미등록 코드는 원문(화면 무해 폴백). */
export function achievementLabel(v: string): string {
  return ACHIEVEMENT_LEVELS.find((l) => l.value === v)?.label ?? v
}

/** DB CHECK(period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') 와 동일. */
const PERIOD_RE = /^[0-9]{4}-(0[1-9]|1[0-2])$/

export function isValidPeriod(period: string): boolean {
  return PERIOD_RE.test(period)
}

/** 기준 시각이 속한 한국 시간(KST, UTC+9·서머타임 없음)의 달 'YYYY-MM'. 서버 TZ 와 무관. */
export function periodInKST(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM' 을 delta 달만큼 이동(연도 넘김 처리). */
export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number)
  const index = y * 12 + (m - 1) + delta
  const year = Math.floor(index / 12)
  const month = (((index % 12) + 12) % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

/** 'YYYY-MM' → '2026년 9월'. */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${y}년 ${m}월`
}

/** period 가 기준 달(보통 오늘의 KST 달)보다 뒤인가 — 'YYYY-MM' 은 사전식 비교 = 시간순. */
export function isFuturePeriod(period: string, currentPeriod: string): boolean {
  return period > currentPeriod
}

/** timestamptz ISO → 한국 시간 표기 '2026.09.25 14:03'. (formatDate 는 앞 10자리를 잘라 UTC 날짜가 나온다.) */
export function formatKSTDateTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const k = new Date(t + 9 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`
}

export interface PlanCandidate {
  id: string
  status: string
  /** 유효 시작일 — 예산 배정 기간 → 계획 기간 → 차수 기간 순으로 보강한 값(모르면 null). */
  start: string | null
  /** 유효 종료일(포함). */
  end: string | null
  createdAt: string
}

const APPROVED = new Set(['approved', 'conditional'])

/**
 * 한 달 평가의 기준 이용계획을 고른다.
 *  ① anchor — 그 달 평가가 이미 참조하는 계획(쓸 때의 계획에 고정. 상태 무관).
 *  ② 승인(approved/conditional) 계획 중 유효 기간이 그 달과 겹치는 것 — 기간을 둘 다 아는 계획 우선,
 *     그다음 시작이 늦은 것, 그다음 최근 생성.
 *  ③ 없으면 가장 최근 승인 계획(시작 늦은 순 → 생성 늦은 순).
 * 앱으로 만든 계획은 기간이 비어 있을 수 있어(NewPlanClient), 호출부가 배정·차수 기간으로 보강해 넘긴다.
 */
export function selectEvaluationPlan(
  plans: PlanCandidate[],
  period: string,
  anchorPlanId?: string | null,
): PlanCandidate | null {
  if (anchorPlanId) {
    const anchor = plans.find((p) => p.id === anchorPlanId)
    if (anchor) return anchor
  }
  const monthStart = `${period}-01`
  const nextMonthStart = `${shiftPeriod(period, 1)}-01`
  const approved = plans.filter((p) => APPROVED.has(p.status))
  const byRecency = (a: PlanCandidate, b: PlanCandidate) => {
    if (a.start !== b.start) {
      if (a.start == null) return 1
      if (b.start == null) return -1
      return a.start < b.start ? 1 : -1
    }
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  }
  const covering = approved
    .filter((p) => (p.start == null || p.start < nextMonthStart) && (p.end == null || p.end >= monthStart))
    .sort((a, b) => {
      const aKnown = a.start != null && a.end != null ? 0 : 1
      const bKnown = b.start != null && b.end != null ? 0 : 1
      return aKnown - bKnown || byRecency(a, b)
    })
  if (covering.length) return covering[0]
  return [...approved].sort(byRecency)[0] ?? null
}

export type SettlementStatusKey = 'pending' | 'accepted' | 'rejected' | 'recovered'

export interface MonthUsageRow {
  amount: number | string
  settlement_status: string
  requested_service_id?: string | null
}

export interface MonthUsageSummary {
  /** 쓴 돈 — 환수(recovered) 제외 합계. v_seoul_monthly_usage.month_spent 와 같은 정의. */
  spent: number
  /** 그 달 지출 건수(환수 포함 전체). */
  count: number
  byStatus: Record<SettlementStatusKey, { count: number; amount: number }>
}

const STATUS_KEYS: SettlementStatusKey[] = ['pending', 'accepted', 'rejected', 'recovered']

/** 그 달 지출 요약 — 쓴 돈(환수 제외)·건수·정산 상태별. 알 수 없는 상태는 합계에만 포함. */
export function summarizeMonthUsage(rows: MonthUsageRow[]): MonthUsageSummary {
  const byStatus = Object.fromEntries(STATUS_KEYS.map((k) => [k, { count: 0, amount: 0 }])) as MonthUsageSummary['byStatus']
  let spent = 0
  for (const r of rows) {
    const amount = Number(r.amount) || 0
    if (r.settlement_status !== 'recovered') spent += amount
    const bucket = byStatus[r.settlement_status as SettlementStatusKey]
    if (bucket) {
      bucket.count += 1
      bucket.amount += amount
    }
  }
  return { spent, count: rows.length, byStatus }
}

/** 계획 항목(신청 서비스)별 그 달 쓴 돈(환수 제외) — 이행 정도 판단 근거. 항목 미연결 지출은 제외. */
export function spentByRequestedService(rows: MonthUsageRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    if (!r.requested_service_id || r.settlement_status === 'recovered') continue
    out[r.requested_service_id] = (out[r.requested_service_id] ?? 0) + (Number(r.amount) || 0)
  }
  return out
}

/** 저장할 내용이 하나라도 있는가 — 서술 3칸 중 하나(공백 제외) 또는 항목 이행도 1건 이상. */
export function evaluationHasContent(input: {
  budgetUsageNote?: string | null
  participantOpinion?: string | null
  overallNote?: string | null
  itemCount: number
}): boolean {
  const filled = [input.budgetUsageNote, input.participantOpinion, input.overallNote].some((v) => !!v?.trim())
  return filled || input.itemCount > 0
}
