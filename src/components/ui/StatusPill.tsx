import type { ReactNode } from 'react'

/**
 * StatusPill — 상태 배지 프리미티브(비색큐 하중). 계약: src/components/ui/StatusPill.test.tsx.
 * rounded-full 배지 ~22곳 + _STYLE/_LABEL 딕셔너리 17파일을 흡수한다.
 * 고대비 모드가 모든 status 토큰을 #fff/#000 으로 blank 처리 → 색이 사라진다.
 * 따라서 상태는 반드시 '글자 라벨'로 읽혀야 한다(S5) — label 은 항상 렌더, icon 은 장식(aria-hidden).
 *
 * intent→토큰 바인딩은 P2 시맨틱 토큰(goala_p2_token_foundation)을 그대로 소비한다.
 * 도메인 상태(pending/recovered 등)→intent 매핑은 각 소비처(settlementStatus 등)의 몫이며
 * 로드맵 §3-3 확정(W)에 따른다 — 이 프리미티브는 intent 를 받아 색만 입힌다.
 */

export type Intent = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

export interface StatusPillProps {
  label: string
  intent: Intent
  icon?: ReactNode
}

const INTENT_CLASS: Record<Intent, string> = {
  success: 'bg-success-bg text-success-fg ring-success-fg/20',
  info: 'bg-info-bg text-info-fg ring-info-fg/20',
  warning: 'bg-warning-bg text-warning-fg ring-warning-fg/20',
  danger: 'bg-danger-bg text-danger-fg ring-danger-fg/20',
  neutral: 'bg-neutral-bg text-neutral-fg ring-neutral-fg/20',
}

export function StatusPill({ label, intent, icon }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${INTENT_CLASS[intent]}`}
    >
      {icon != null && (
        <span aria-hidden="true" className="inline-flex items-center">
          {icon}
        </span>
      )}
      {label}
    </span>
  )
}
