import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NavDropdown from './NavDropdown'

/**
 * P6 Phase C — nav 완전성 GUARD: NavDropdown 랜드마크·aria-current·토글 (이미 green 회귀락)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §nav (contract nav.navdropdown.landmark-and-current)
 *
 * ★거짓 RED 금지 — NavDropdown 은 이미: nav aria-label='페이지 이동', 현재 항목 aria-current='page',
 * 토글 min-h-[44px] min-w-[44px] + aria-label. 테스트 파일만 부재 → 회귀락(GUARD)으로 신규 저작.
 * (NAV_ITEMS 가 <div> 링크 나열인 점은 nav 트랙 소유이며 이 웨이브 list 범위 밖 — 중복 계약 금지.)
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/receipt',
}))

describe('P6-C nav GUARD — NavDropdown (navdropdown-landmark-current)', () => {
  it('토글 버튼이 44px 터치 크기 + 접근명을 가진다', () => {
    render(<NavDropdown />)
    const toggle = screen.getByRole('button', { name: '메뉴 열기' })
    expect(toggle.className).toMatch(/min-h-\[44px\]/)
    expect(toggle.className).toMatch(/min-w-\[44px\]/)
  })

  it("열림 상태에서 nav 랜드마크 '페이지 이동' 과 활성항목 aria-current='page' 1개를 가진다", async () => {
    const user = userEvent.setup()
    render(<NavDropdown />)
    await user.click(screen.getByRole('button', { name: '메뉴 열기' }))

    expect(await screen.findByRole('navigation', { name: '페이지 이동' })).toBeInTheDocument()

    const current = document.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('영수증')
  })
})
