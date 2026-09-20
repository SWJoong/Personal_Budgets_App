/**
 * 쉬운 용어 사전 — 행정·제도 용어(formal) → 발달장애 당사자용 쉬운 말(easy). 계약: src/utils/easyTerms.test.ts.
 * 설계: docs/release/14 P1(EasyTerm 전반화) · 발달장애인법 §10 의사소통지원.
 *
 * ★배경: 당사자 화면 문구는 P7 에서 대부분 기본값이 이미 쉬운 말이라, '쉬운 말' 토글이 온보딩 3곳
 *   외에는 사실상 무효였다(dead affordance). 이 사전 + <Term> 은 **제도상 남는 공식 용어**(이용계획 등,
 *   P7 도 원문 유지)에 대해 토글 시 더 쉬운 말로 바꿔 토글을 의미 있게 만든다.
 * ★원칙: 뜻을 바꾸지 않는 범위의 쉬운 말(easy-read). 새 용어는 여기 한 곳에만 추가(일관성). formal 을
 *   화면에 그대로 쓰고 easy 는 토글 시 노출 — 표현은 <Term>·globals.css .term-formal/.term-easy 가 담당.
 */

export const EASY_TERMS: Record<string, string> = {
  이용계획: '하고 싶은 일 계획',
  본인부담금: '내가 낼 돈',
  정산: '돈 맞추기',
  '예산 배정': '나에게 온 돈',
  잔액: '남은 돈',
  지출: '쓴 돈',
  모니터링: '잘 지내는지 살펴보기',
  욕구사정: '무엇이 필요한지 알아보기',
}

/** formal 용어의 쉬운 말. 사전에 없으면 null(호출부는 formal 그대로 노출). */
export function easyTerm(formal: string): string | null {
  return EASY_TERMS[formal] ?? null
}
