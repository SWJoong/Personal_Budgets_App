import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { TabBar } from './TabBar'

/**
 * TabBar — P4 내비게이션 통일 RED 계약 (W 작성, U 초록화 · test-first).
 * 설계출처: Plan&Source/krds_ux_a11y_W.md §2.4/§3 (nav landmark·aria-current·터치타깃)
 *   + 사용자 확정 결정(2026-09-04): 당사자 하단 내비 = 정확히 4탭
 *   [홈 '/' · 달력 '/calendar' · 계획 '/plan' · 더보기 '/more'] + '지출 적기' FAB(→/receipt).
 *   ★영수증 탭 없음 — FAB 가 /receipt 를 단독 소유(목적지 중복 제거). 갤러리는 '더보기' 안.
 *
 * 단언 범위: 행위·ARIA·구조만. 색상/토큰/픽셀/시각대비/CSS 위치는 단언하지 않는다
 *   (raw zinc/white/amber → P2 시맨틱 토큰 치환은 tokenFoundation 락 + W 리뷰 스윕 담당).
 *   현재 min-w-[64px]/min-w-[44px] 중복 클래스는 구현 시 단일 터치타깃으로 정리 권고(계약 아님).
 *
 * 훅 의존: 역할분기가 usePathname + useAuth(profiles.role)에 의존 → 두 훅 모킹.
 *   useAuth 는 user=null → TabBar 내부 role 기본값 'participant' 로 당사자 탭 렌더.
 *
 * RED 선언: participantTabs 가 현재 [홈'/', 영수증'/receipt', 더보기'/more'] 3탭이라
 *   달력·계획 링크가 코드에 부재하고 영수증 탭이 잔존 → length===4·/calendar·/plan·영수증 null
 *   단언이 모두 FALSE. U 가 4탭으로 리팩터하면 초록.
 */

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, supabase: {} }),
}))

const mockUsePathname = vi.mocked(usePathname)

beforeEach(() => {
  mockUsePathname.mockReturnValue('/')
})

describe('TabBar — 당사자 4탭 구조 계약 (participant-tabbar-4tab-structure)', () => {
  it("navigation 랜드마크를 '메인 네비게이션' 이름으로 노출한다", () => {
    render(<TabBar />)
    // nav 랜드마크 + accessible name — 키보드/SR 내비 진입점
    expect(screen.getByRole('navigation', { name: '메인 네비게이션' })).toBeInTheDocument()
  })

  it('당사자 역할일 때 내비 안에 링크가 정확히 4개다', () => {
    render(<TabBar />)
    const nav = screen.getByRole('navigation', { name: '메인 네비게이션' })
    // RED: 현재 3탭(홈·영수증·더보기) → 4 아님
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
  })

  it("'홈' 탭의 href 는 '/' 다", () => {
    render(<TabBar />)
    expect(screen.getByRole('link', { name: /홈/ })).toHaveAttribute('href', '/')
  })

  it("'달력' 탭이 존재하고 href 는 '/calendar' 다", () => {
    render(<TabBar />)
    // RED: 달력 링크 미존재 → getByRole throw
    expect(screen.getByRole('link', { name: /달력/ })).toHaveAttribute('href', '/calendar')
  })

  it("'계획' 탭이 존재하고 href 는 '/plan' 다", () => {
    render(<TabBar />)
    // RED: 계획 링크 미존재 → getByRole throw
    expect(screen.getByRole('link', { name: /계획/ })).toHaveAttribute('href', '/plan')
  })

  it("'더보기' 탭의 href 는 '/more' 다", () => {
    render(<TabBar />)
    expect(screen.getByRole('link', { name: /더보기/ })).toHaveAttribute('href', '/more')
  })

  it("'영수증' 탭은 없다 — FAB 가 /receipt 를 단독 소유(목적지 중복 제거)", () => {
    render(<TabBar />)
    // RED: 현재 영수증 탭 잔존 → null 아님
    expect(screen.queryByRole('link', { name: /영수증/ })).toBeNull()
  })
})

describe('TabBar — 당사자 활성 탭 aria-current 계약 (participant-tabbar-active-aria-current)', () => {
  it("pathname='/calendar' 이면 '달력' 링크만 aria-current='page' 를 갖는다", () => {
    mockUsePathname.mockReturnValue('/calendar')
    render(<TabBar />)
    // RED: 달력 링크 자체가 미존재 → 활성 해석 성립 불가
    const active = screen.getByRole('link', { name: /달력/ })
    expect(active).toHaveAttribute('aria-current', 'page')

    // 활성은 정확히 하나 — 나머지 탭은 aria-current 미보유
    const nav = screen.getByRole('navigation', { name: '메인 네비게이션' })
    const current = within(nav)
      .getAllByRole('link')
      .filter((el) => el.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
  })

  it("pathname='/' 이면 '홈' 링크만 aria-current='page' 를 갖는다 ('/' 는 정확일치 활성 · 회귀가드)", () => {
    mockUsePathname.mockReturnValue('/')
    render(<TabBar />)
    expect(screen.getByRole('link', { name: /홈/ })).toHaveAttribute('aria-current', 'page')

    const nav = screen.getByRole('navigation', { name: '메인 네비게이션' })
    const current = within(nav)
      .getAllByRole('link')
      .filter((el) => el.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
  })
})
