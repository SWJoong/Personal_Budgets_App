import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Term } from './Term'

/**
 * <Term> 계약 — 사전 기반 EasyTerm 래퍼. docs/release/14 P1.
 * 표시 전환은 globals.css(html.easy-terms)가 하므로 여기선 formal/easy 두 텍스트가 DOM 에 있는지만 본다.
 */

describe('Term', () => {
  it('사전에 있는 용어는 formal 과 easy 를 모두 렌더한다(토글은 CSS)', () => {
    const { container } = render(<Term formal="이용계획" />)
    expect(container.querySelector('.term-formal')?.textContent).toBe('이용계획')
    expect(container.querySelector('.term-easy')?.textContent).toBe('하고 싶은 일 계획')
  })

  it('사전에 없는 용어는 formal 원문만 렌더(EasyTerm 래핑 없음)', () => {
    const { container } = render(<Term formal="사전에없는용어" />)
    expect(container.textContent).toBe('사전에없는용어')
    expect(container.querySelector('.term-easy')).toBeNull()
    expect(container.querySelector('.term-formal')).toBeNull()
  })

  it('easy prop 은 사전보다 우선한다(문맥별 커스텀)', () => {
    const { container } = render(<Term formal="이용계획" easy="나의 계획" />)
    expect(container.querySelector('.term-easy')?.textContent).toBe('나의 계획')
  })
})
