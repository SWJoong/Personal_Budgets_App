import { describe, it, expect } from 'vitest'
import { formatCurrency } from './budget-visuals'

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
