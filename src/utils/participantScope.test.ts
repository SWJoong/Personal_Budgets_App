import { describe, it, expect } from 'vitest'
import { scopeMarkersToUsed, scopePlansToParticipant } from './participantScope'

/**
 * 당사자 허브 스코프 필터 계약 (W 작성 · 추출 순수함수 잠금).
 * 스펙출처: 08 §8 ④ — 당사자 허브에서 `?participant=pid` 로 진입하면 그 당사자 컨텍스트로 좁히고,
 *   파라미터가 없으면(전역 모드) 무필터로 전체 뷰를 그대로 둔다(사이드바 등 전체 진입 불변).
 *
 * map/page.tsx · plans/page.tsx 의 인라인 삼항 필터에서 추출. 두 축의 불변식:
 *   (1) 스코프 모드: 마커는 usageCount>0(실제 쓴 곳)만, 계획은 participant_id 일치만.
 *   (2) 전역 모드(participantId 미지정): 입력 배열을 필터 없이 **그대로**(참조·내용) 반환.
 */

describe('scopeMarkersToUsed — 지도 마커 스코프 필터', () => {
  it('스코프 모드(pid 있음): 실제 쓴 곳(usageCount>0)만 남긴다', () => {
    const markers = [
      { usageCount: 0, id: 'unused-place' },
      { usageCount: 3, id: 'used-place' },
    ]
    const scoped = scopeMarkersToUsed(markers, 'p1')
    // 쓴 곳(usageCount:3) 1건만, 그리고 원본 객체를 온전히 통과(id 보존).
    expect(scoped).toEqual([{ usageCount: 3, id: 'used-place' }])
  })

  it('전역 모드(pid 미지정): 전체 마커를 그대로 반환 — 내용 동일 + 같은 배열 참조(무필터)', () => {
    const markers = [{ usageCount: 0 }, { usageCount: 3 }]
    const result = scopeMarkersToUsed(markers, undefined)
    expect(result).toEqual(markers) // 내용: 필터 안 함(usageCount:0 도 유지)
    expect(result).toBe(markers) // 참조: 필터 복사본이 아니라 입력 배열 자체
  })
})

describe('scopePlansToParticipant — 계획 목록 스코프 필터', () => {
  it("스코프 모드(pid 있음): participant_id 일치 계획만 남긴다", () => {
    const plans = [
      { participant_id: 'a', id: 'plan-a' },
      { participant_id: 'b', id: 'plan-b' },
    ]
    const scoped = scopePlansToParticipant(plans, 'a')
    // 'a' 계획 1건만, 원본 객체 온전 통과(id 보존).
    expect(scoped).toEqual([{ participant_id: 'a', id: 'plan-a' }])
  })

  it('전역 모드(pid 미지정): 전체 계획을 그대로 반환 — 내용 동일 + 같은 배열 참조(무필터)', () => {
    const plans = [{ participant_id: 'a' }, { participant_id: 'b' }]
    const result = scopePlansToParticipant(plans, undefined)
    expect(result).toEqual(plans)
    expect(result).toBe(plans)
  })
})
