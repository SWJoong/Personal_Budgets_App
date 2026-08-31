/**
 * 정산·평가 타임라인 병합 — GOAL축 A 평가(모니터링·정산) 화면.
 * 설계: Plan&Source/goala_evaluation_monitoring_ux_W.md §7. 계약: evaluationTimeline.test.ts.
 *
 * domainAxisReport.ts / budgetByDomain.ts 의 형제 — DB·렌더 없이 순수함수로 불변식을 못박는다.
 * 모니터링·정산·심의 3종 원시 행을 참여자(또는 배정) 그레인의 정렬된 타임라인으로 합친다.
 */

export interface MonitoringRow {
  id: string
  monitoringDate: string
  method: string | null
  /** 실무자 관찰. participantVoice 와 절대 한 칸에 합치지 않는다(스키마 §11 원칙). */
  observedChange: string | null
  /** 당사자 본인의 말. 원문 그대로 — 순화·요약 금지. */
  participantVoice: string | null
  /** 배정 이전에도 모니터링 가능 → nullable. 배정 없는 기록도 타임라인에 포함. */
  allocationId: string | null
}

export interface SettlementRow {
  id: string
  allocationId: string
  settledPeriod: string
  acceptedAmount: number
  rejectedAmount: number
  recoveredAmount: number
  unusedAmount: number
}

export interface PlanReviewRow {
  id: string
  decision: 'approved' | 'conditional' | 'rejected'
  reason: string | null
  reviewDate: string
}

export type TimelineEntryKind = 'monitoring' | 'settlement' | 'review'

export interface TimelineEntry {
  kind: TimelineEntryKind
  /** ISO — 정렬 키(monitoringDate / settledPeriod / reviewDate 에서 채택). */
  date: string
  id: string
  // kind 별 원본 행 그대로 보존(화면이 필요한 만큼 골라 쓴다 — 분리 원칙 유지).
  monitoring?: MonitoringRow
  settlement?: SettlementRow
  review?: PlanReviewRow
}

/** 동일 날짜 tie-break 우선순위: monitoring > settlement > review(재현성). */
const KIND_ORDER: Record<TimelineEntryKind, number> = {
  monitoring: 0,
  settlement: 1,
  review: 2,
}

/**
 * 3종을 날짜 내림차순으로 병합. 같은 날짜는 monitoring > settlement > review 순.
 * 빈 입력 3개 → 빈 배열(널 아님). 배정 없는 모니터링(allocationId=null)도 누락 없이 포함.
 */
export function buildEvaluationTimeline(
  monitoring: MonitoringRow[],
  settlements: SettlementRow[],
  reviews: PlanReviewRow[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...monitoring.map((m): TimelineEntry => ({ kind: 'monitoring', date: m.monitoringDate, id: m.id, monitoring: m })),
    ...settlements.map((s): TimelineEntry => ({ kind: 'settlement', date: s.settledPeriod, id: s.id, settlement: s })),
    ...reviews.map((r): TimelineEntry => ({ kind: 'review', date: r.reviewDate, id: r.id, review: r })),
  ]

  return entries.sort((a, b) => {
    const ta = new Date(a.date).getTime()
    const tb = new Date(b.date).getTime()
    if (tb !== ta) return tb - ta // 날짜 내림차순(최신 먼저)
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] // 동일 날짜 tie-break
  })
}

/**
 * 정산 미사용 해석 — 같은 배정의 모니터링 기록 중 settledPeriod(연-월)와 겹치는
 * observedChange 발췌를 찾아 "왜 남았는지" 맥락을 붙인다.
 * unused_amount<=0 이면 항상 undefined(맥락 불필요). 겹치는 기록이 없으면 undefined
 * (화면은 "확인 필요" 배지로 대체).
 */
export function unusedContext(
  settlement: SettlementRow,
  monitoring: MonitoringRow[],
): string | undefined {
  if (settlement.unusedAmount <= 0) return undefined

  const period = settlement.settledPeriod.slice(0, 7) // 'YYYY-MM'
  const match = monitoring.find(
    (m) =>
      m.allocationId === settlement.allocationId &&
      m.monitoringDate.slice(0, 7) === period &&
      !!m.observedChange,
  )
  return match?.observedChange ?? undefined
}
