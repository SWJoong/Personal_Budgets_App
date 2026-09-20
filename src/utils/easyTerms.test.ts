import { describe, it, expect } from 'vitest'
import { EASY_TERMS, easyTerm } from './easyTerms'

/**
 * 쉬운 용어 사전 계약 — docs/release/14 P1(EasyTerm 전반화).
 */

describe('easyTerm', () => {
  it('사전에 있는 공식 용어는 쉬운 말을 준다', () => {
    expect(easyTerm('이용계획')).toBe('하고 싶은 일 계획')
    expect(easyTerm('본인부담금')).toBe('내가 낼 돈')
    expect(easyTerm('잔액')).toBe('남은 돈')
  })

  it('사전에 없으면 null(호출부가 formal 그대로 노출)', () => {
    expect(easyTerm('존재하지않는용어')).toBeNull()
    expect(easyTerm('')).toBeNull()
  })

  it('모든 매핑은 비어있지 않은 쉬운 말이고, formal 과 다르다', () => {
    for (const [formal, easy] of Object.entries(EASY_TERMS)) {
      expect(easy.trim().length).toBeGreaterThan(0)
      expect(easy).not.toBe(formal)
    }
  })
})
