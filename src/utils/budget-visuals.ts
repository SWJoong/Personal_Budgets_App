/**
 * 예산 상태에 따른 시각적 정보를 처리하는 유틸리티
 * §3.2 능동형 평서문 / §5.1 예산 대시보드 시각화
 */

/**
 * §5.1 인상률 알림: 전월 대비 예산 변동을 감지하고 시각 메시지를 반환해요.
 * @param previousBudget 전월 예산 (없으면 null)
 * @param currentBudget 이번 달 예산
 */
export function getBudgetChangeInfo(
  previousBudget: number | null,
  currentBudget: number
): { changed: boolean; direction: 'up' | 'down' | 'same'; icon: string; message: string } {
  if (previousBudget === null || previousBudget === 0) {
    return { changed: false, direction: 'same', icon: '💰', message: '' };
  }

  const diff = currentBudget - previousBudget;
  const changePercent = Math.round((diff / previousBudget) * 100);

  if (changePercent > 0) {
    return {
      changed: true,
      direction: 'up',
      icon: '💰⬆️',
      message: `이번 달 예산이 지난달보다 ${formatCurrency(diff)}원 늘었어요!`,
    };
  } else if (changePercent < 0) {
    return {
      changed: true,
      direction: 'down',
      icon: '💰⬇️',
      message: `이번 달 예산이 지난달보다 ${formatCurrency(Math.abs(diff))}원 줄었어요.`,
    };
  }

  return { changed: false, direction: 'same', icon: '💰', message: '' };
}

/**
 * §5.1 월평균 한도 경보: 현재 사용 속도가 월 한도를 초과할 위험이 있는지 확인해요.
 * @param spentSoFar 이번 달 사용 금액
 * @param daysPassed 이번 달 경과일
 * @param totalDaysInMonth 이번 달 총 일수
 * @param monthlyBudget 이번 달 예산
 */
export function getSpendingPaceAlert(
  spentSoFar: number,
  daysPassed: number,
  totalDaysInMonth: number,
  monthlyBudget: number
): { alert: boolean; projectedTotal: number; message: string } {
  if (daysPassed === 0) {
    return { alert: false, projectedTotal: 0, message: '' };
  }

  const dailyAverage = spentSoFar / daysPassed;
  const projectedTotal = Math.round(dailyAverage * totalDaysInMonth);

  if (projectedTotal > monthlyBudget) {
    const overAmount = projectedTotal - monthlyBudget;
    return {
      alert: true,
      projectedTotal,
      message: `이대로 쓰면 이번 달 예산보다 ${formatCurrency(overAmount)}원 더 쓸 수 있어요. 조금 아껴봐요.`,
    };
  }

  return { alert: false, projectedTotal, message: '' };
}

/**
 * 숫자를 한국어 통화 형식으로 바꿔요.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}
