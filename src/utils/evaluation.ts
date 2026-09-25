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
