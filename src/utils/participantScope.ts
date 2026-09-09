/**
 * 당사자 허브(participants/[id])에서 `?participant=pid` 로 진입한 화면의 **스코프 필터** 순수함수
 * (08 §8 ④). 전역(participantId 없음)이면 무필터 — 사이드바 등 전체 뷰는 불변.
 * 인라인 필터를 계약 가능하게 분리. 계약: src/utils/participantScope.test.ts.
 */

/**
 * 지도 마커를 이 당사자가 '실제 쓴 곳'(usageCount>0)만 남긴다(스코프 모드).
 * usages 를 이미 participant 로 좁혀 빌드했다는 전제 — 그러면 usageCount>0 = 그 당사자가 쓴 장소.
 * @param participantId 없으면(전역 모드) 전체 마커 그대로.
 */
export function scopeMarkersToUsed<T extends { usageCount: number }>(
  markers: T[],
  participantId?: string
): T[] {
  return participantId ? markers.filter((m) => m.usageCount > 0) : markers
}

/**
 * 계획 목록을 특정 당사자(participant_id) 것만 남긴다(스코프 모드).
 * @param participantId 없으면(전역 모드) 전체 계획 그대로.
 */
export function scopePlansToParticipant<T extends { participant_id: string }>(
  plans: T[],
  participantId?: string
): T[] {
  return participantId ? plans.filter((p) => p.participant_id === participantId) : plans
}
