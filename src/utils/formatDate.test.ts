import { describe, it, expect } from 'vitest'
import { formatDate } from './formatDate'

/**
 * formatDate — 날짜 표기 정본 계약 (W 작성 · 특성화/회귀보호).
 * 스펙출처: src/utils/formatDate.ts 헤더(08 §8 ①) — "ISO 문자열의 앞 10자리(날짜)를
 *   '2026.08.15' 로 통일. null·빈값은 '-'. 시각·타임존은 버린다."
 *
 * 단언은 '의도된 출력 문자열'을 겨냥한다(구현의 slice/replace 표현식을 베끼지 않음).
 * 경계: 빈값 폴백 3종 / 순수 ISO 날짜 / 타임스탬프(Z·오프셋·공백구분) / zero-pad 한자리.
 */

describe('formatDate — 빈값은 대시(-) 로 폴백', () => {
  it('null → "-"', () => {
    expect(formatDate(null)).toBe('-')
  })

  it('undefined → "-"', () => {
    expect(formatDate(undefined)).toBe('-')
  })

  it("빈 문자열('') → \"-\"", () => {
    expect(formatDate('')).toBe('-')
  })
})

describe('formatDate — 순수 ISO 날짜(YYYY-MM-DD)는 점 표기로', () => {
  it("'2026-08-15' → '2026.08.15'", () => {
    expect(formatDate('2026-08-15')).toBe('2026.08.15')
  })

  it("zero-padded 한 자리 월/일도 그대로 유지 — '2026-01-05' → '2026.01.05'", () => {
    expect(formatDate('2026-01-05')).toBe('2026.01.05')
  })

  it('세 개의 하이픈이 아니라 두 개(날짜 구분자)만 점으로 치환된다', () => {
    // 결과는 정확히 점 2개·자리수 10 — 구분자 개수 회귀 방어
    const out = formatDate('2026-12-31')
    expect(out).toBe('2026.12.31')
    expect(out.length).toBe(10)
    expect((out.match(/\./g) ?? []).length).toBe(2)
  })
})

describe('formatDate — 타임스탬프는 앞 10자리(날짜)만 남기고 시각·타임존 버림', () => {
  it("UTC 타임스탬프 '2026-08-15T10:30:00Z' → '2026.08.15'", () => {
    expect(formatDate('2026-08-15T10:30:00Z')).toBe('2026.08.15')
  })

  it("소수초+오프셋 '2026-08-15T10:30:00.123456+09:00' → '2026.08.15'", () => {
    expect(formatDate('2026-08-15T10:30:00.123456+09:00')).toBe('2026.08.15')
  })

  it("공백 구분 타임스탬프(Postgres) '2026-08-15 10:30:00' → '2026.08.15'", () => {
    expect(formatDate('2026-08-15 10:30:00')).toBe('2026.08.15')
  })

  it('시각 부분의 콜론은 결과에 남지 않는다(날짜만)', () => {
    expect(formatDate('2026-08-15T23:59:59Z')).not.toContain(':')
  })
})
