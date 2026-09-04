import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ComingSoon from './ComingSoon'

/**
 * P6 Phase C — nav 완전성 GUARD: ComingSoon 랜드마크·h1·홈링크 (이미 green 회귀락)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §nav (contract nav.comingsoon.landmark-and-h1)
 *
 * ComingSoon 은 22개 준비중 화면 공통 진입 셸 → 회귀락 가치 높음. 이미:
 * main#main-content, 헤더 <h1>{title}</h1>(유일 h1; '준비하고 있어요'는 h2), 뒤로/홈 링크 44px.
 */
describe('P6-C nav GUARD — ComingSoon (comingsoon-landmark-h1)', () => {
  it('main#main-content 랜드마크와 유일 h1(title)을 가진다', () => {
    const { container } = render(<ComingSoon title="테스트 화면" />)
    expect(container.querySelector('#main-content')).not.toBeNull()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('테스트 화면')
  })

  it('홈으로 가기 링크가 44px 터치 크기 클래스를 가진다', () => {
    render(<ComingSoon title="테스트 화면" />)
    const homeLinks = screen.getAllByRole('link', { name: '홈으로 가기' })
    expect(homeLinks.length).toBeGreaterThanOrEqual(1)
    expect(
      homeLinks.some((l) => /min-h-\[44px\]|min-w-\[44px\]/.test(l.className)),
    ).toBe(true)
  })
})
