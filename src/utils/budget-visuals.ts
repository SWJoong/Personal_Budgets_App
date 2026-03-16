/**
 * 예산 상태에 따른 시각적 정보를 처리하는 유틸리티
 */

export type BudgetStatus = 'positive' | 'warning' | 'danger' | 'stable';

export interface VisualInfo {
  status: BudgetStatus;
  message: string;
  icon: string;
  percentage: number;
}

/**
 * 예산 퍼센트와 남은 날짜를 기반으로 상태 정보를 반환합니다.
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

  // 1% 단위 시각화 로직 기반 상태 결정
  if (percentage <= 10) {
    status = 'danger';
    message = '모든 예산을 사용했습니다. 다음 달 계획을 기다려주세요.';
    icon = '🪹'; // 텅 빈 그릇/주머니 느낌
  } else if (percentage <= 20) {
    status = 'danger';
    message = '남은 돈이 아주 적습니다. 꼭 필요한 곳에만 사용하세요.';
    icon = '👛'; // 작은 지갑
  } else if (percentage < daysPercentage - 10) {
    // 날짜가 많이 남았는데 예산은 그보다 훨씬 빨리 줄어들고 있는 경우
    status = 'warning';
    message = '예산을 조금 빠르게 쓰고 있습니다. 조금만 천천히 써볼까요?';
    icon = '💸';
  } else if (percentage >= 81) {
    status = 'positive';
    message = '예산이 넉넉합니다. 계획하신 대로 즐겁게 사용하세요!';
    icon = '💰';
  } else if (percentage >= 61) {
    status = 'stable';
    message = '안정적으로 예산을 사용하고 있습니다. 좋아요!';
    icon = '👛';
  } else {
    status = 'stable';
    message = '지금 속도로 쓰면 계획에 맞게 사용할 수 있습니다.';
    icon = '👛';
  }

  return { status, message, icon, percentage };
}

/**
 * 숫자를 한국어 통화 형식으로 변환합니다.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}
