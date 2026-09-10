import { describe, it, expect } from 'vitest'
import { won } from './won'

/**
 * 계약(W레인) : 공용 결정성 원화 포맷 `won` — AI 소스텍스트(요약·활동제안)용.
 *
 * 배경: easyReadSummary.ts 와 activitySuggestion.ts 가 **byte-identical** 한 지역 won() 을
 * 각자 정의하고 있었다(중복). 이를 공용 src/utils/won.ts 하나로 추출한다(통일).
 *
 * ★설계 의도 보존: 이 포맷터는 Intl(로케일 기반 formatCurrency) 이 아니라 **Math.round + 정규식
 * 수동 콤마**로 **로케일/ICU 비의존(결정성)** 을 보장한다 — AI 소스텍스트가 실행 환경(small-icu 등)에
 * 관계없이 재현되도록. 따라서 통일은 formatCurrency 로의 교체가 아니라 "동일 함수를 한 곳으로 추출"이며,
 * 이 계약이 그 결정성 동작(반올림·수동 그룹핑·음수·경계)을 정확히 잠근다.
 *
 * test-first: won.ts 가 아직 없으므로 이 import 는 RED(모듈 없음). U 가 추출하면 green.
 */

describe('won — 공용 결정성 원화 포맷', () => {
  it('세 자리 그룹핑에 콤마를 넣는다', () => {
    expect(won(1234567)).toBe('1,234,567원')
    expect(won(120000)).toBe('120,000원')
    expect(won(150000)).toBe('150,000원')
  })

  it('그룹핑 경계: 999 는 콤마 없음, 1000 은 콤마', () => {
    expect(won(999)).toBe('999원')
    expect(won(1000)).toBe('1,000원')
  })

  it('0 원', () => {
    expect(won(0)).toBe('0원')
  })

  it('소수는 정규 반올림한다(Math.round)', () => {
    expect(won(1234.5)).toBe('1,235원')
    expect(won(1234.4)).toBe('1,234원')
    expect(won(999.5)).toBe('1,000원')
  })

  it('음수도 안전하다(부호 뒤에서 그룹핑)', () => {
    expect(won(-1234567)).toBe('-1,234,567원')
    expect(won(-1000)).toBe('-1,000원')
  })

  it('로케일 비의존(결정성) — Intl 이 아니라 수동 그룹핑이라 환경 무관 동일', () => {
    // 이 값들은 Intl.NumberFormat('ko-KR') 와도 같은 그룹핑이지만, 계약의 요지는
    // 구현이 Intl 에 의존하지 않고도 이 결과를 보장한다는 것이다.
    expect(won(1000000)).toBe('1,000,000원')
  })
})
