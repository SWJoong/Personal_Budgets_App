/**
 * 정산 상태(seoul_service_usages.settlement_status) 라벨·intent(§3-3) — 거래장부 화면들이 공유(중복 정의 방지).
 * 설계: Plan&Source/goala_comingsoon_stubs_triage_W.md §4-1.
 * 소비: supporter/transactions(org 원장) · supporter/[participantId]/transactions.
 */

import type { Intent } from '@/components/ui/StatusPill'

export const SETTLEMENT_LABEL: Record<string, string> = {
  pending: '정산 대기',
  accepted: '정산 완료',
  rejected: '반려',
  recovered: '환수',
}

/** 미지 상태는 원문 그대로 표시(누락 금지). */
export function settlementLabel(status: string): string {
  return SETTLEMENT_LABEL[status] ?? status
}

/**
 * 정산 상태 → StatusPill intent(§3-3). 색은 보조, 라벨(settlementLabel)이 비색큐 단서.
 * pending(정산 대기)=warning(처리 필요·액션) · accepted(정산 완료)=success ·
 * rejected(반려)=danger · recovered(환수)=info(완료된 정보성 결과) · 미지=neutral.
 */
export function settlementIntent(status: string): Intent {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'accepted':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'recovered':
      return 'info'
    default:
      return 'neutral'
  }
}
