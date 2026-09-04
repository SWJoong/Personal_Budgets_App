import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'

/**
 * P5 IA — AdminSidebar 라벨 명확화 + 관리자 nav 도달성 (W 작성 · test-first).
 * 설계출처: Plan&Source/goala_p5_ia_W.md §라벨 · §nav-reachability.
 *
 * 기존 P4 계약(AdminSidebar.test.tsx: aria-current·aria-expanded)은 건드리지 않는다.
 * 이 파일은 P5 스코프 (d)라벨 명확화 + nav-reachability(도달성) 두 계약만 추가한다.
 *
 * 훅 의존: usePathname + useAuth 모킹(기존 P4 테스트와 동일 패턴).
 * 단언 범위: 행위(접근가능 이름·href)만. redirect 아님(force-merge 금물) — 링크 추가로 초록.
 */

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/admin'),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, supabase: { auth: { signOut: vi.fn() } } }),
}))

const mockUsePathname = vi.mocked(usePathname)

beforeEach(() => {
  mockUsePathname.mockReturnValue('/admin')
})

describe("AdminSidebar — 당사자 현황 라벨 명확화 (adminsidebar/participant-hyeonhwang-label)", () => {
  it("/supporter/participants 링크의 접근가능 이름이 /당사자 현황/ 을 만족한다", () => {
    // pathname='/admin/participants' → '당사자 관리' 부모가 활성 → 서브메뉴 자동 펼침
    // (현황 서브 링크가 렌더되어야 이름을 단언할 수 있다).
    mockUsePathname.mockReturnValue('/admin/participants')
    render(<AdminSidebar />)
    // RED: 현재 서브 라벨은 '📊 통합 현황' 이라 '당사자'를 담지 않아 매칭 실패.
    //   확정 IA '당사자 관리 vs 당사자 현황' — '통합 현황'→'당사자 현황' rename 시 초록.
    const link = screen.getByRole('link', { name: /당사자 현황/ })
    expect(link).toHaveAttribute('href', '/supporter/participants')
  })

  it("현황 허브(supporter/participants)와 관리 CRUD(admin/participants)가 접근가능 이름만으로 구분된다", () => {
    mockUsePathname.mockReturnValue('/admin/participants')
    render(<AdminSidebar />)
    // 현황 = /당사자 현황/ → /supporter/participants (청중: 업무진입·통합현황)
    const status = screen.getByRole('link', { name: /당사자 현황/ })
    expect(status).toHaveAttribute('href', '/supporter/participants')
    // 관리 = '당사자 관리' 부모 → /admin/participants (청중: 등록·CRUD)
    const manage = screen.getByRole('link', { name: /당사자 관리/ })
    expect(manage).toHaveAttribute('href', '/admin/participants')
  })
})

describe("AdminSidebar — 관리자 초대 nav 도달성 (nav-reachability/admin-invitations)", () => {
  it("/admin/invitations 로 가는 링크가 관리자 nav 표면에 존재한다", async () => {
    const user = userEvent.setup()
    render(<AdminSidebar />)
    // 표면 유연성: U 가 menuItems(상시 노출) 또는 quickItems(빠른 설정 하위)에 배선 가능.
    // quickItems 는 기본 접힘이므로 '빠른 설정' 을 펼쳐 두 표면 모두 커버한다.
    await user.click(screen.getByRole('button', { name: /빠른 설정/ }))
    // RED: 현재 menuItems/quickItems 어디에도 /admin/invitations 부재 → getByRole throw.
    //   기능하는 페이지(getInvitations+InvitationsClient)이나 인바운드 링크 0.
    //   redirect 아님 — AdminSidebar 에 링크 추가 시 초록(force-merge 금물).
    const link = screen.getByRole('link', { name: /초대/ })
    expect(link).toHaveAttribute('href', '/admin/invitations')
  })
})
