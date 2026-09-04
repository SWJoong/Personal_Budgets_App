import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import ParticipantLayout from './layout'

/**
 * (participant)/layout — P4 내비 랜드마크 마운트 계약 (W 작성 · test-first).
 * 설계출처: Plan&Source/krds_ux_a11y_W.md §3 + 사용자 확정 결정(2026-09-04).
 *
 * 목표: 당사자 화면에 navigation 랜드마크(TabBar 4탭)가 존재해야 한다 — 키보드/SR 내비 진입점.
 *   현재 레이아웃은 <ParticipantFab/> 만 렌더하고 TabBar import·마운트가 없어 당사자 화면에
 *   navigation 랜드마크 자체가 부재하다. FAB 는 유지하되 nav 랜드마크를 추가하는 '공존' 구조가 목표.
 *
 * 마운트 전략: 이 레이아웃은 동기 서버 컴포넌트라 jsdom 통합 렌더가 가능하다. children 과 함께
 *   렌더해 navigation 랜드마크 도달성을 단언한다. TabBar 는 useAuth/usePathname 에 의존하므로
 *   두 훅을 모킹(user=null → 당사자 역할, pathname='/').
 *
 * 단언 범위: 행위·구조·ARIA 만(랜드마크 존재). 토큰/CSS/배치는 단언하지 않는다.
 *
 * RED 선언: layout 이 TabBar 를 import·마운트하지 않아 당사자 화면에 navigation 랜드마크가 없다 →
 *   getByRole('navigation') 도달 불가로 FALSE. U 가 TabBar 를 (FAB 와 공존하도록) 마운트하면 초록.
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

describe('(participant)/layout — 내비 랜드마크 마운트 (participant-layout-mounts-nav-landmark)', () => {
  it('당사자 레이아웃은 children 과 함께 navigation 랜드마크(TabBar)를 마운트한다', () => {
    render(
      <ParticipantLayout>
        <div data-testid="page-child">본문</div>
      </ParticipantLayout>
    )
    // children 은 렌더된다(통합 렌더 성립 확인)
    expect(screen.getByTestId('page-child')).toBeInTheDocument()
    // RED: 현재 TabBar 미마운트 → navigation 랜드마크 부재
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('nav 랜드마크와 FAB 가 공존한다 — FAB 목적지는 유지된다', () => {
    render(
      <ParticipantLayout>
        <div>본문</div>
      </ParticipantLayout>
    )
    // FAB 는 계속 존재(회귀가드)
    expect(screen.getByRole('link', { name: '내가 쓴 돈 적기' })).toHaveAttribute('href', '/receipt')
    // 그리고 navigation 랜드마크도 함께(RED: 현재 부재)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
