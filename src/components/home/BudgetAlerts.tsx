import type { getBudgetChangeInfo, getSpendingPaceAlert } from '@/utils/budget-visuals'

/**
 * BudgetAlerts — 당사자 홈의 예산 변동·소비속도 알림 (고아 기능 복원 §2, 프리젠테이셔널).
 * 설계: Plan&Source/goala_orphan_features_restore_W.md §2.
 *
 * 배경: getBudgetChangeInfo/getSpendingPaceAlert 는 순수 함수(메시지·상태만, 색 클래스 없음)로
 *   만들어졌으나 소비처 0(리빌드 유실). 두 결과를 받아 활성인 것만 카드로 보여준다.
 * 색은 여기서 시맨틱 토큰으로만 입힌다 — 변동↑=info, 변동↓·소비속도 경고=warning.
 * 아이콘은 장식(aria-hidden), 메시지 텍스트가 실제 내용(접근명)이다. 둘 다 비활성이면 아무것도 안 그린다.
 */

export interface BudgetAlertsProps {
  changeInfo: ReturnType<typeof getBudgetChangeInfo>
  paceAlert: ReturnType<typeof getSpendingPaceAlert>
}

export default function BudgetAlerts({ changeInfo, paceAlert }: BudgetAlertsProps) {
  const showChange = changeInfo.changed
  const showPace = paceAlert.alert
  if (!showChange && !showPace) return null

  return (
    <div className="flex flex-col gap-3">
      {showChange && (
        <section
          className={`p-5 rounded-3xl ring-1 flex items-center gap-3 ${
            changeInfo.direction === 'up'
              ? 'bg-info-bg text-info-fg ring-info-fg/20'
              : 'bg-warning-bg text-warning-fg ring-warning-fg/20'
          }`}
        >
          <span aria-hidden="true" className="text-2xl shrink-0">
            {changeInfo.icon}
          </span>
          <p className="text-sm font-bold leading-relaxed">{changeInfo.message}</p>
        </section>
      )}

      {showPace && (
        <section className="p-5 rounded-3xl ring-1 bg-warning-bg text-warning-fg ring-warning-fg/20 flex items-center gap-3">
          <span aria-hidden="true" className="text-2xl shrink-0">
            🏃
          </span>
          <p className="text-sm font-bold leading-relaxed">{paceAlert.message}</p>
        </section>
      )}
    </div>
  )
}
