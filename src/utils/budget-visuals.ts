/**
 * 예산 상태에 따른 시각적 정보를 처리하는 유틸리티
 * §3.2 능동형 평서문 / §5.1 예산 대시보드 시각화
 */

export type BudgetStatus = 'luxury' | 'stable' | 'observing' | 'shrinking' | 'critical' | 'empty' | 'warning';

export interface VisualInfo {
  status: BudgetStatus;
  message: string;
  icon: string;
  percentage: number;
  themeColor: string;
  bgClass: string;
}

/**
 * 예산 퍼센트와 남은 날짜를 기반으로 상태 정보를 반환해요.
 * §3.2 — 모든 메시지를 능동형 평서문으로 작성
 */
export function getBudgetVisualInfo(
  currentBalance: number,
  totalBudget: number,
  remainingDays: number,
  totalDaysInMonth: number
): VisualInfo {
  const percentage = Math.max(0, Math.min(100, Math.round((currentBalance / totalBudget) * 100)));
  
  // 남은 날짜 비율 (예: 30일 중 15일 남았으면 50%)
  const daysPercentage = (remainingDays / totalDaysInMonth) * 100;
  
  let status: BudgetStatus = 'stable';
  let message = '';
  let icon = '💰';
  let themeColor = 'zinc';
  let bgClass = 'bg-white';

  // 1% 단위 시각화 로직 (§5.1 기준)
  if (percentage >= 81) {
    status = 'luxury';
    message = '예산이 넉넉해요. 계획한 대로 즐겁게 사용해요!';
    icon = '💰'; // 꽉 찬 돈주머니
    themeColor = 'green';
    bgClass = 'bg-green-50';
  } else if (percentage >= 61) {
    status = 'stable';
    message = '예산이 안정적이에요. 잘하고 있어요!';
    icon = '👛'; // 지갑
    themeColor = 'blue';
    bgClass = 'bg-blue-50';
  } else if (percentage >= 41) {
    status = 'observing';
    message = '예산을 살펴보며 쓰고 있어요. 지금처럼만 해요.';
    icon = '🪙'; // 동전
    themeColor = 'indigo';
    bgClass = 'bg-zinc-50';
  } else if (percentage >= 21) {
    status = 'shrinking';
    message = '남은 돈이 줄고 있어요. 다음 활동을 신중히 골라봐요.';
    icon = '💸'; // 날아가는 돈
    themeColor = 'orange';
    bgClass = 'bg-orange-50';
  } else if (percentage >= 11) {
    status = 'critical';
    message = '남은 돈이 적어요. 꼭 필요한 곳에만 사용하는 게 좋아요.';
    icon = '⚠️'; // 경고
    themeColor = 'red';
    bgClass = 'bg-red-50';
  } else {
    status = 'empty';
    message = '이번 달 예산을 다 사용했어요. 다음 달을 기다려요.';
    icon = '🪹'; // 빈 그릇
    themeColor = 'red';
    bgClass = 'bg-red-100';
  }

  // 특수 상태: 잔액 비율이 남은 날짜 비율보다 15% 이상 낮을 때 (너무 빨리 쓰고 있을 때)
  if (percentage > 10 && percentage < daysPercentage - 15) {
    message = '예산을 조금 빠르게 쓰고 있어요. 조금만 천천히 써봐요.';
    icon = '🏃';
    status = 'warning';
    themeColor = 'orange';
    bgClass = 'bg-orange-50';
  }

  return { status, message, icon, percentage, themeColor, bgClass };
}

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
