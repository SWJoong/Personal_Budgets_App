import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import NavDropdown from '@/components/layout/NavDropdown'

/**
 * P6 Phase B — 모달 소비자 배선 계약: NavDropdown (우측 드로어).
 * 설계출처: Plan&Source/goala_p6_phaseB_W.md §Modal 소비자 매핑.
 *
 * 버킷: [ALIGN] — 이미 Modal 소비(중앙 대신 우측정렬 override). 트리거의 haspopup/expanded 계약과
 *   열기/닫기 배선을 잠근다. RED 아님. Esc/포커스/scroll-lock 은 Modal.test.tsx 소유 → 재작성 금지.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('NavDropdown p6 소비자 — haspopup/expanded + 열기/닫기', () => {
  it('[ALIGN] 트리거는 aria-haspopup=dialog 이고 열기 전 aria-expanded=false 다', () => {
    render(<NavDropdown />)
    const trigger = screen.getByRole('button', { name: '메뉴 열기' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('[ALIGN] 열면 접근성 이름을 가진 dialog 가 뜨고 트리거 aria-expanded=true 가 된다', () => {
    render(<NavDropdown />)
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
    expect(
      screen.getByRole('dialog', { name: '페이지 이동 메뉴' }),
    ).toBeInTheDocument()
    // 열린 뒤 트리거 라벨은 '메뉴 닫기' 로 바뀌고 expanded=true.
    expect(screen.getByRole('button', { name: '메뉴 닫기', expanded: true })).toBeInTheDocument()
  })

  it('[ALIGN] 드로어 안의 닫기 버튼을 누르면 dialog 가 사라진다', () => {
    render(<NavDropdown />)
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
    const dialog = screen.getByRole('dialog', { name: '페이지 이동 메뉴' })
    // 드로어 내부의 '메뉴 닫기'(트리거와 라벨이 겹치므로 dialog 스코프로 한정).
    fireEvent.click(within(dialog).getByRole('button', { name: '메뉴 닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
