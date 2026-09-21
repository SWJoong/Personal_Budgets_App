import { describe, it, expect } from 'vitest'
import { monitoringHasContent } from './monitoring'

describe('monitoringHasContent', () => {
  it('관찰 또는 당사자 말 중 하나라도 있으면 true', () => {
    expect(monitoringHasContent('표정이 밝아짐', null)).toBe(true)
    expect(monitoringHasContent(null, '재밌었어요')).toBe(true)
    expect(monitoringHasContent('관찰', '말')).toBe(true)
  })

  it('둘 다 비어있거나 공백·null 이면 false', () => {
    expect(monitoringHasContent(null, null)).toBe(false)
    expect(monitoringHasContent('', '')).toBe(false)
    expect(monitoringHasContent('   ', '  ')).toBe(false)
    expect(monitoringHasContent(undefined, undefined)).toBe(false)
  })
})
