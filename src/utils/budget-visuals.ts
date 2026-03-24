/**
 * 예산 상태에 따른 시각적 정보를 처리하는 유틸리티
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
  let themeColor = 'zinc';
  let bgClass = 'bg-white';

  // 1% 단위 시각화 로직 (구현 계획서 7.1 기준)
  if (percentage >= 81) {
    status = 'luxury';
    message = '예산이 넉넉합니다. 계획하신 대로 즐겁게 사용하세요!';
    icon = '💰'; // 꽉 찬 돈주머니
    themeColor = 'green';
    bgClass = 'bg-green-50';
  } else if (percentage >= 61) {
    status = 'stable';
    message = '예산이 안정적입니다. 잘하고 있어요!';
    icon = '👛'; // 지갑
    themeColor = 'blue';
    bgClass = 'bg-blue-50';
  } else if (percentage >= 41) {
    status = 'observing';
    message = '예산을 살펴보며 쓰고 있습니다. 지금처럼만 해주세요.';
    icon = '🪙'; // 동전
    themeColor = 'indigo';
    bgClass = 'bg-zinc-50';
  } else if (percentage >= 21) {
    status = 'shrinking';
    message = '남은 돈이 줄고 있습니다. 다음 활동을 신중히 골라볼까요?';
    icon = '💸'; // 날아가는 돈
    themeColor = 'orange';
    bgClass = 'bg-orange-50';
  } else if (percentage >= 11) {
    status = 'critical';
    message = '남은 돈이 적습니다. 꼭 필요한 곳에만 사용하는 것이 좋아요.';
    icon = '⚠️'; // 경고
    themeColor = 'red';
    bgClass = 'bg-red-50';
  } else {
    status = 'empty';
    message = '이번 달 예산을 모두 사용했습니다. 다음 달을 기다려주세요.';
    icon = '🪹'; // 빈 그릇
    themeColor = 'red';
    bgClass = 'bg-red-100';
  }

  // 특수 상태: 잔액 비율이 남은 날짜 비율보다 15% 이상 낮을 때 (너무 빨리 쓰고 있을 때)
  if (percentage > 10 && percentage < daysPercentage - 15) {
    message = '예산을 조금 빠르게 쓰고 있습니다. 조금만 천천히 써볼까요?';
    icon = '🏃';
    status = 'warning';
    themeColor = 'orange';
    bgClass = 'bg-orange-50';
  }

  return { status, message, icon, percentage, themeColor, bgClass };
}

/**
 * 숫자를 한국어 통화 형식으로 변환합니다.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}
