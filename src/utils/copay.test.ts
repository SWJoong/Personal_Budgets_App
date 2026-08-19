/**
 * 계약(골든) 테스트 — 본인부담금 표시 규칙.  [작성: W(설계·검증) / 파일럿]
 *
 * 이 테스트는 "구현이 이렇게 동작한다"의 기록이 아니라 "이렇게 동작해야 한다"는 **스펙**이다.
 * 발달장애인 당사자에게 돈 관련 정보를 잘못 보여주면 해가 되므로(예고 없는 청구·면제자에 금액 노출),
 * 아래 안전 속성을 골든으로 못 박는다. 구현(src/utils/copay.ts)은 U가 초록으로 유지한다.
 *
 * 배치 위치(합의 후): src/utils/copay.test.ts  (통합 base: db-ontology-rdf-format)
 */
import { describe, it, expect } from 'vitest'
import { describeCopay, copayStatusLabel } from './copay'

describe('describeCopay — 당사자 화면 계약', () => {
  it('면제 대상(기초생활/차상위)은 입력 금액과 무관하게 0원으로 강제한다 [안전 속성]', () => {
    for (const s of ['exempt_basic_livelihood', 'exempt_near_poor']) {
      const r = describeCopay(s, 999_999) // 양수를 넣어도
      expect(r.show).toBe(true)
      expect(r.amount).toBe(0) // 절대 새어나오면 안 된다
      expect(r.pending).toBe(false)
      expect(r.title).toBe('내가 낼 돈은 없어요')
    }
  })

  it("'charged'는 실제 금액을 그대로 통과시키고, 예산에서 안 빠진다고 안내한다", () => {
    const r = describeCopay('charged', 240_000)
    expect(r).toMatchObject({ show: true, amount: 240_000, pending: false, title: '내가 낼 돈' })
    expect(r.note).toContain('빠지지 않아요')
  })

  it("'unverified'만 pending=true (시각적 구분 필요)", () => {
    const r = describeCopay('unverified', 240_000)
    expect(r).toMatchObject({ show: true, amount: 240_000, pending: true })
    expect(r.title).toContain('확인 중')
  })

  it("제도 없는 차수('not_applicable')·null·undefined·알 수 없는 값은 영역을 숨긴다 [혼란 방지]", () => {
    for (const s of ['not_applicable', null, undefined, 'weird_value']) {
      const r = describeCopay(s as string | null | undefined, 100_000)
      expect(r.show).toBe(false)
      expect(r.amount).toBe(0)
    }
  })
})

describe('copayStatusLabel — 실무자 화면 계약', () => {
  it('상태별 한국어 라벨이 당사자용 쉬운 말과 목적이 다르다', () => {
    expect(copayStatusLabel('exempt_basic_livelihood')).toBe('면제 (기초생활수급)')
    expect(copayStatusLabel('exempt_near_poor')).toBe('면제 (차상위)')
    expect(copayStatusLabel('charged')).toBe('부과')
    expect(copayStatusLabel('unverified')).toBe('수급 구분 미확인')
    expect(copayStatusLabel('not_applicable')).toBe('해당 없음 (부담금 제도 없는 차수)')
    expect(copayStatusLabel('weird')).toBe('알 수 없음')
  })
})
