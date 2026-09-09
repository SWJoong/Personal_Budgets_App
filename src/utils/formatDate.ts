/**
 * 날짜 표기 정본 — ISO 문자열(YYYY-MM-DD…)을 한국어 표기 "2026.08.15" 로 통일한다.
 * 화면마다 usage_date 원문(2026-08-15)·지역 slice/replace 가 섞여 있던 것을 이 한 함수로 모은다
 * (08 §8 ①). 금액의 MoneyText/formatCurrency 에 대응하는 날짜 쪽 단일 진실원천.
 *
 * @param d ISO 날짜/타임스탬프 문자열. null·빈값이면 '-'.
 * @returns "2026.08.15" (앞 10자리를 점 구분). 시각·타임존은 버린다(날짜만).
 */
export function formatDate(d: string | null | undefined): string {
  if (!d) return '-'
  return d.slice(0, 10).replace(/-/g, '.')
}
