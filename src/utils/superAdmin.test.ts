import { describe, it, expect } from 'vitest'
import { parseSuperAdminEmails, isSuperAdminEmail } from './superAdmin'

/**
 * superAdmin — 슈퍼관리자(운영자) 판정 정본 계약 (W 작성 · 추출 회귀보호).
 *
 * 스펙출처: src/utils/superAdmin.ts 헤더(08 §9 C3) + 사용자 명시요구(2026-09-07).
 *   "BUILTIN(cheese0318@gmail.com) 은 배포 환경변수(SUPER_ADMIN_EMAIL) 설정 여부와
 *    무관하게 '항상' 슈퍼관리자로 인식한다. SUPER_ADMIN_EMAIL 은 콤마로 여러 개 지정 가능,
 *    대소문자 무관, 공백 trim, 빈 토큰 제거."
 *   추출 전 인라인(auth/callback/route.ts) 로직의 동작보존을 계약으로 못박는다.
 *
 * 단언은 '의도된 동작(누가 관리자인가)'을 겨냥한다 — 구현의 split/map/filter 표현식을
 * 베끼지 않는다(동어반복 금지).
 */

describe('isSuperAdminEmail — 내장 슈퍼관리자는 env 없이도 관리자 (goal #4 핵심)', () => {
  it('cheese0318@gmail.com 은 SUPER_ADMIN_EMAIL 미설정(undefined)이어도 true', () => {
    // Vercel 환경변수를 깜빡해도 로그인만 하면 관리자 접근 보장.
    expect(isSuperAdminEmail('cheese0318@gmail.com', undefined)).toBe(true)
  })

  it("빈 문자열('') env 도 내장 보장 — true", () => {
    expect(isSuperAdminEmail('cheese0318@gmail.com', '')).toBe(true)
  })

  it('SUPER_ADMIN_EMAIL 이 다른 값으로 설정돼 있어도 내장은 살아있다 — true', () => {
    // env 를 켜는 것이 내장 슈퍼관리자를 끄지 않는다(병합 규칙).
    expect(isSuperAdminEmail('cheese0318@gmail.com', 'someone@else.org')).toBe(true)
  })
})

describe('isSuperAdminEmail — 대소문자 무관', () => {
  it('CHEESE0318@Gmail.com (혼합 대소문자) 도 내장 매칭 — true', () => {
    expect(isSuperAdminEmail('CHEESE0318@Gmail.com', undefined)).toBe(true)
  })

  it('env 목록도 대소문자 무관으로 매칭 — 입력 대문자 vs env 소문자', () => {
    expect(isSuperAdminEmail('A@B.COM', 'a@b.com')).toBe(true)
  })
})

describe('isSuperAdminEmail — SUPER_ADMIN_EMAIL 콤마 다중 + 공백 trim', () => {
  it("' a@b.com , c@d.com ' 에서 앞 원소 a@b.com 매칭(공백 trim) — true", () => {
    expect(isSuperAdminEmail('a@b.com', ' a@b.com , c@d.com ')).toBe(true)
  })

  it("'a@b.com,c@d.com' 에서 뒤 원소 c@d.com 매칭 — true", () => {
    expect(isSuperAdminEmail('c@d.com', 'a@b.com,c@d.com')).toBe(true)
  })

  it('목록에 없는 이메일은 env 가 있어도 false', () => {
    expect(isSuperAdminEmail('z@z.com', 'a@b.com,c@d.com')).toBe(false)
  })
})

describe('isSuperAdminEmail — 비대상은 false', () => {
  it('x@y.com + env 미설정 → false (내장에도 env 에도 없음)', () => {
    expect(isSuperAdminEmail('x@y.com', undefined)).toBe(false)
  })
})

describe('parseSuperAdminEmails — 병합·정규화 목록', () => {
  it('undefined → 내장만(소문자) = [cheese0318@gmail.com]', () => {
    expect(parseSuperAdminEmails(undefined)).toEqual(['cheese0318@gmail.com'])
  })

  it("',, ' (빈 토큰·공백만) → 내장만 (빈 토큰 filter 제거)", () => {
    // split 결과의 '', '', ' ' 는 trim 후 전부 falsy → 제거. 내장만 남는다.
    expect(parseSuperAdminEmails(',, ')).toEqual(['cheese0318@gmail.com'])
  })

  it("'A@B.com' → 소문자화 포함, 내장과 병합", () => {
    const list = parseSuperAdminEmails('A@B.com')
    expect(list).toContain('a@b.com') // 소문자화됨
    expect(list).not.toContain('A@B.com') // 원본 대문자는 남지 않음
    expect(list).toEqual(['cheese0318@gmail.com', 'a@b.com'])
  })

  it('콤마 다중 + 공백 → 각 원소 trim·소문자, 내장 선두', () => {
    expect(parseSuperAdminEmails(' Foo@X.com , BAR@y.com ')).toEqual([
      'cheese0318@gmail.com',
      'foo@x.com',
      'bar@y.com',
    ])
  })
})
