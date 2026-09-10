/** 원화 포맷(로케일 비의존, 결정성). 음수도 안전. AI 요약·활동제안 소스텍스트용. */
export function won(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
}
