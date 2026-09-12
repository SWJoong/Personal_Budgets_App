import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SuperAdminSwitcher from './SuperAdminSwitcher'

/**
 * 슈퍼관리자 역할 화면 전환기 계약 (W 레인). 사용자 요청: cheese0318 로그인 시 우측 상단 관리자 표시 +
 *   실무자·당사자 화면 전환. 설계: Plan&Source/goala_balance_widget_roleswitch_W.md §2.
 * 구현: src/components/layout/SuperAdminSwitcher.tsx.
 *
 * 안전: 전환은 서버 액션 superAdminSwitch(assertSuperAdmin)로만 — 쿠키/권한 확장 아님(기존 view-as 재사용).
 *   컴포넌트는 isSuperAdmin=true 일 때만 렌더(레이아웃이 서버에서 판정해 내려줌).
 *
 * RED 사유: SuperAdminSwitcher 가 아직 없다. 액션은 목킹.
 */

const switchMock = vi.fn()
vi.mock('@/app/actions/viewAs', () => ({
  superAdminSwitch: (...a: unknown[]) => switchMock(...a),
}))

beforeEach(() => switchMock.mockReset())
afterEach(() => cleanup())

describe('SuperAdminSwitcher — 역할 화면 전환기', () => {
  it('슈퍼관리자가 아니면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<SuperAdminSwitcher isSuperAdmin={false} current="admin" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('슈퍼관리자면 관리자 표시 + 3역할 전환 컨트롤을 보여준다', () => {
    render(<SuperAdminSwitcher isSuperAdmin current="admin" />)
    expect(screen.getByText(/관리자/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /관리자/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /실무자/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /당사자/ })).toBeInTheDocument()
  })

  it('현재 보고 있는 역할이 눌린 상태(aria-pressed)로 표시된다', () => {
    render(<SuperAdminSwitcher isSuperAdmin current="supporter" />)
    expect(screen.getByRole('button', { name: /실무자/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /당사자/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('실무자 선택 → superAdminSwitch("supporter")', async () => {
    const user = userEvent.setup()
    render(<SuperAdminSwitcher isSuperAdmin current="admin" />)
    await user.click(screen.getByRole('button', { name: /실무자/ }))
    expect(switchMock).toHaveBeenCalledWith('supporter')
  })

  it('당사자 선택 → superAdminSwitch("participant")', async () => {
    const user = userEvent.setup()
    render(<SuperAdminSwitcher isSuperAdmin current="admin" />)
    await user.click(screen.getByRole('button', { name: /당사자/ }))
    expect(switchMock).toHaveBeenCalledWith('participant')
  })
})
