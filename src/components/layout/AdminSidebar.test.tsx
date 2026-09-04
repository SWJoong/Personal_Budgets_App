import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'

/**
 * AdminSidebar — P4 실무자/관리자 1차 내비 ARIA 계약 (W 작성 · test-first).
 * 설계출처: Plan&Source/krds_ux_a11y_W.md §2.4/§3 (aria-current·disclosure aria-expanded).
 *
 * 목표: 활성 위치와 펼침/접힘 상태를 시각큐뿐 아니라 프로그램적으로(SR·키보드) 전달한다.
 *   현재 활성표시는 bg-white/10 + animate-pulse 점(시각큐)뿐이고, 서브메뉴·빠른설정 토글은
 *   aria-label 만 있고 aria-expanded 가 없다.
 *
 * 훅 의존: usePathname(활성경로) + useAuth(user·supabase) 모킹.
 * 단언 범위: 행위·ARIA 만(aria-current·aria-expanded). 토큰/색/그라디언트/배치는 단언하지 않는다.
 * 오탐 방지: nav aria-label='주요 메뉴' 와 모바일 햄버거(SupporterLayoutClient)는 이미 PASS —
 *   RED 로 넣지 않는다.
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

describe('AdminSidebar — 활성 메뉴 aria-current (admin-sidebar-active-aria-current)', () => {
  it("pathname='/admin/participants' 이면 '당사자 관리' 링크가 aria-current='page' 를 갖는다", () => {
    mockUsePathname.mockReturnValue('/admin/participants')
    render(<AdminSidebar />)
    // RED: 파일 내 aria-current 0건 — 활성표시가 시각큐뿐
    expect(screen.getByRole('link', { name: /당사자 관리/ })).toHaveAttribute('aria-current', 'page')
  })

  it('비활성 메뉴 링크는 aria-current 를 갖지 않는다', () => {
    mockUsePathname.mockReturnValue('/admin/participants')
    render(<AdminSidebar />)
    // '관리자 대시보드'(/admin)는 비활성
    expect(screen.getByRole('link', { name: /관리자 대시보드/ })).not.toHaveAttribute('aria-current')
  })

  it("활성 서브항목(pathname===sub.href)도 aria-current='page' 를 갖는다", () => {
    // '📋 전체 목록' 의 href 는 /admin/participants
    mockUsePathname.mockReturnValue('/admin/participants')
    render(<AdminSidebar />)
    // RED: 서브 링크에도 aria-current 부재
    expect(screen.getByRole('link', { name: /전체 목록/ })).toHaveAttribute('aria-current', 'page')
  })
})

describe('AdminSidebar — 서브메뉴 disclosure aria-expanded (admin-sidebar-submenu-aria-expanded)', () => {
  it('서브 보유 항목의 토글 버튼이 접힘상태에 맞는 aria-expanded 를 노출하고, 클릭 시 반영한다', async () => {
    mockUsePathname.mockReturnValue('/admin') // 대시보드 활성 → 서브 항목들은 기본 접힘
    const user = userEvent.setup()
    render(<AdminSidebar />)

    // 서브 토글 버튼(aria-label '펼치기'/'접기')만 매칭 — 사이드바 접기·빠른설정·로그아웃과 구분
    const toggle = screen.getAllByRole('button', { name: /펼치기|접기/ })[0]
    // RED: 파일 내 aria-expanded 0건 — 토글에 상태 속성 부재
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('AdminSidebar — 빠른 설정 disclosure aria-expanded (admin-sidebar-quicksettings-aria-expanded)', () => {
  it("'빠른 설정' 버튼이 quickOpen 상태에 맞는 aria-expanded 를 노출하고, 클릭 시 반영한다", async () => {
    const user = userEvent.setup()
    render(<AdminSidebar />)

    const quick = screen.getByRole('button', { name: /빠른 설정/ })
    // RED: 버튼에 aria-expanded 부재
    expect(quick).toHaveAttribute('aria-expanded', 'false')

    await user.click(quick)
    expect(quick).toHaveAttribute('aria-expanded', 'true')
  })
})
