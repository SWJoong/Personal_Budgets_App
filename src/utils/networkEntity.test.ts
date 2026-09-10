import { describe, it, expect } from 'vitest'
import {
  validateNetworkEntityInput,
  RELATION_CATEGORIES,
  type NetworkEntityInput,
} from './networkEntity'

/**
 * B2 관계망 — 입력 검증 골든 (W 레인).
 * 설계출처: Plan&Source/goala_relationship_network_crud_W.md §2 B2.
 * 구현 대상: src/utils/networkEntity.ts (validateNetworkEntityInput 신규 순수 함수 + 타입).
 *
 * 배경: 'use server' 액션 파일은 async export만 허용 → 순수 동기 검증은 util 로 뗀다(needsAssessment 관습).
 *   4분면(relation_category)·이름 필수·closeness 1~4 를 액션 전에 못박아 나쁜 입력을 DB 전에 거른다.
 *
 * 계약: 유효→null · participantId/이름 누락→메시지 · 분면 밖→메시지 · closeness 1~4 밖→메시지.
 *   closeness null/미지정은 허용(선택 필드).
 *
 * RED 사유: validateNetworkEntityInput 가 아직 없다 → import 실패.
 */

function valid(over: Partial<NetworkEntityInput> = {}): NetworkEntityInput {
  return {
    participantId: 'p-1',
    relationCategory: 'family',
    entityName: '김엄마',
    ...over,
  }
}

describe('validateNetworkEntityInput (B2)', () => {
  it('4분면 상수는 family/friend/paid_support/community', () => {
    expect([...RELATION_CATEGORIES].sort()).toEqual(['community', 'family', 'friend', 'paid_support'])
  })

  it('유효한 입력 → null', () => {
    expect(validateNetworkEntityInput(valid())).toBeNull()
    expect(validateNetworkEntityInput(valid({ closeness: 1 }))).toBeNull()
    expect(validateNetworkEntityInput(valid({ closeness: 4 }))).toBeNull()
    expect(validateNetworkEntityInput(valid({ closeness: null }))).toBeNull() // 선택
  })

  it('participantId 누락 → 메시지', () => {
    expect(validateNetworkEntityInput(valid({ participantId: '' }))).toBeTruthy()
  })

  it('이름 공백/누락 → 메시지', () => {
    expect(validateNetworkEntityInput(valid({ entityName: '   ' }))).toBeTruthy()
    expect(validateNetworkEntityInput(valid({ entityName: '' }))).toBeTruthy()
  })

  it('4분면 밖 값 → 메시지', () => {
    expect(
      validateNetworkEntityInput(valid({ relationCategory: 'coworker' as NetworkEntityInput['relationCategory'] })),
    ).toBeTruthy()
  })

  it('closeness 1~4 밖 → 메시지', () => {
    expect(validateNetworkEntityInput(valid({ closeness: 0 }))).toBeTruthy()
    expect(validateNetworkEntityInput(valid({ closeness: 5 }))).toBeTruthy()
  })
})
