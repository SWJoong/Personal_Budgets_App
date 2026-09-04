import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'

/**
 * P6 Phase C — touch44: AdminSidebar 접기/펼치기 토글 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §touch-label (contract touch-label.adminsidebar.collapse-touch)
 *
 * onToggle 이 있을 때 나타나는 사이드바 접기 토글 버튼은 className 이 'w-8 h-8'(32×32px)라
 * 44px 터치 영역 미달. (nav landmark·aria-current·서브 aria-expanded 는 P4/P5 가 이미 커버
 * → 여기서 재단언하지 않는다. 이 계약은 오직 토글 터치 크기.)
 *
 * ★겹침경고: AdminSidebar impl 파일은 다크토큰 브랜치와 겹침 → U impl 은 다크토큰 머지 후
 * rebase 필요(계약=신규 test 파일이라 무겹침). 설계문 참조.
 * 렌더 게이트: 'use client' + usePathname/useAuth 모킹 → 렌더 가능.
 */
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/admin'),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, supabase: { auth: { signOut: vi.fn() } } }),
}))

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue('/admin')
})

describe('P6-C touch44 — AdminSidebar 접기 토글 (adminsidebar-collapse-touch)', () => {
  it('[RED] 접기 토글 버튼이 44px 터치 크기 클래스를 가진다', () => {
    render(<AdminSidebar collapsed={false} onToggle={() => {}} />)
    // 접힘 아님 → title='사이드바 접기'(접근명)
    const toggle = screen.getByRole('button', { name: '사이드바 접기' })
    // RED: 현재 className 이 'w-8 h-8'(32px) — 최소 터치 크기 클래스 없음
    expect(toggle.className).toMatch(/min-h-11|min-w-11|min-h-\[44px\]|min-w-\[44px\]|w-11|h-11/)
  })
})
