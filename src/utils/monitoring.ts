/**
 * 모니터링 기록 순수 검증 — 등록·수정 공통 불변식. 계약: src/utils/monitoring.test.ts.
 *
 * 서울형에는 정형 평가가 없어 이 기록이 성과의 근거다(schema 주석). 방법(method)만으로는 내용이 없으니,
 * 실무자 관찰(observed) 또는 당사자의 말(voice) 중 최소 하나는 있어야 한다. 등록 폼·수정 폼·서버 액션이 공유.
 */
export function monitoringHasContent(
  observed: string | null | undefined,
  voice: string | null | undefined,
): boolean {
  return Boolean(observed?.trim()) || Boolean(voice?.trim())
}
