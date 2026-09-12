import { describe, it, expect } from 'vitest'
import { getActivityEmoji } from './activityEmoji'

/**
 * 활동 자동 이모지 골든 (W 레인). 고아 기능 복원 — 거래·활동 설명에서 이모지를 뽑아 시각 인지 보조.
 * 설계: Plan&Source/goala_orphan_features_restore_W.md §3.
 *
 * 배경: getActivityEmoji(설명→이모지 규칙)는 만들어졌으나 소비처 0(리빌드 유실). 목록에 배선하기 전
 *   규칙 매칭·폴백을 골든으로 고정한다(순수 함수).
 */
describe('getActivityEmoji — 활동 설명 → 이모지', () => {
  it('음식·카페 규칙', () => {
    expect(getActivityEmoji('스타벅스 커피')).toBe('☕')
    expect(getActivityEmoji('점심 식사')).toBe('🍽️')
  })
  it('문화·여가 규칙', () => {
    expect(getActivityEmoji('영화 관람')).toBe('🎬')
    // ★규칙은 순서대로 첫 매칭 — "도서 구입"은 '구입'(쇼핑)이 먼저라 🛍️. 순수 책 활동으로 검증.
    expect(getActivityEmoji('독서 모임')).toBe('📚')
  })
  it('건강·교통 규칙', () => {
    expect(getActivityEmoji('병원 진료')).toBe('🏥')
    expect(getActivityEmoji('버스 교통비')).toBe('🚌')
  })
  it('매칭 없으면 기본 이모지(📝)', () => {
    expect(getActivityEmoji('그 외 알 수 없는 것')).toBe('📝')
    expect(getActivityEmoji('')).toBe('📝')
  })
})
