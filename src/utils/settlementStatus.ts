/**
 * 정산 상태(seoul_service_usages.settlement_status) 라벨·스타일 — 거래장부 화면들이 공유(중복 정의 방지).
 * 설계: Plan&Source/goala_comingsoon_stubs_triage_W.md §4-1.
 * 소비: supporter/transactions(org 원장) · supporter/[participantId]/transactions.
 */

export const SETTLEMENT_LABEL: Record<string, string> = {
  pending: '정산 대기',
  accepted: '정산 완료',
  rejected: '반려',
  recovered: '환수',
}

export const SETTLEMENT_STYLE: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
  recovered: 'bg-amber-50 text-amber-700',
}

/** 미지 상태는 원문 그대로 표시(누락 금지). */
export function settlementLabel(status: string): string {
  return SETTLEMENT_LABEL[status] ?? status
}

/** 미지 상태는 중립 스타일. */
export function settlementStyle(status: string): string {
  return SETTLEMENT_STYLE[status] ?? 'bg-zinc-100 text-zinc-600'
}
