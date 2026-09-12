import { describe, it, expect } from 'vitest'
import { formatCurrency, getBudgetChangeInfo, getSpendingPaceAlert } from './budget-visuals'

describe('formatCurrency', () => {
  it('천 단위 구분자를 붙인다', () => {
    expect(formatCurrency(1000)).toBe('1,000')
    expect(formatCurrency(50000)).toBe('50,000')
    expect(formatCurrency(1500000)).toBe('1,500,000')
  })

  it('0원을 처리한다', () => {
    expect(formatCurrency(0)).toBe('0')
  })

  it('소수점 금액을 처리한다', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.5')
  })
})

/**
 * 고아 기능 복원 — 예산 변동 알림 골든 (W 레인). 설계: goala_orphan_features_restore_W.md §2.
 * 기존에 소비처 0(리빌드 유실)이고 테스트도 없던 함수 — 홈 배선 전 계약으로 고정.
 */
describe('getBudgetChangeInfo — 전월 대비 예산 변동', () => {
  it('전월 없음/0 이면 변동 없음', () => {
    expect(getBudgetChangeInfo(null, 2000000).changed).toBe(false)
    expect(getBudgetChangeInfo(0, 2000000).changed).toBe(false)
  })
  it('늘면 up + 증가 메시지', () => {
    const r = getBudgetChangeInfo(1000000, 1500000)
    expect(r.changed).toBe(true)
    expect(r.direction).toBe('up')
    expect(r.message).toMatch(/늘었어요/)
  })
  it('줄면 down + 감소 메시지', () => {
    const r = getBudgetChangeInfo(2000000, 1500000)
    expect(r.direction).toBe('down')
    expect(r.message).toMatch(/줄었어요/)
  })
  it('동일하면 변동 없음', () => {
    expect(getBudgetChangeInfo(2000000, 2000000).changed).toBe(false)
  })
})

describe('getSpendingPaceAlert — 소비 속도 경고', () => {
  it('경과일 0 이면 경고 없음(나눗셈 방어)', () => {
    expect(getSpendingPaceAlert(0, 0, 30, 2000000).alert).toBe(false)
  })
  it('이대로 가면 예산 초과 → 경고', () => {
    // 10일에 1,000,000 → 30일 예상 3,000,000 > 예산 2,000,000
    const r = getSpendingPaceAlert(1000000, 10, 30, 2000000)
    expect(r.alert).toBe(true)
    expect(r.projectedTotal).toBe(3000000)
    expect(r.message).toMatch(/더 쓸 수 있어요|아껴/)
  })
  it('예산 내 속도면 경고 없음', () => {
    // 10일에 300,000 → 예상 900,000 < 2,000,000
    expect(getSpendingPaceAlert(300000, 10, 30, 2000000).alert).toBe(false)
  })
})
