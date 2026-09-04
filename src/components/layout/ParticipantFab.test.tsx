import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import ParticipantFab from './ParticipantFab'

/**
 * ParticipantFab — P4 목적지 중복 가드 계약 (W 작성 · test-first).
 * 설계출처: Plan&Source/krds_ux_a11y_W.md §3 + 사용자 확정 결정(2026-09-04):
 *   '지출 적기' FAB 가 /receipt 를 단독 소유한다. TabBar 에서 영수증 탭을 제거한 뒤에도
 *   FAB 가 /receipt 목적지를 유지(중복 없이)해야 한다.
 *
 * 성격: 대부분 이미 GREEN — 3→4탭 공존 리팩터 시 /receipt 를 다시 nav 탭으로 넣거나
 *   FAB 를 탭으로 흡수하는 회귀를 잡는 가드다. RED 사유는 인접 리팩터 회귀로 한정.
 *   단언 범위: 행위·ARIA 만. FAB 를 TabBar '위'에 배치·safe-area·하단충돌 해소는 CSS 리뷰(jsdom 불가).
 */

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

const mockUsePathname = vi.mocked(usePathname)

beforeEach(() => {
  mockUsePathname.mockReturnValue('/')
})

describe('ParticipantFab — 목적지 중복 가드 (participant-fab-destination-guard)', () => {
  it("'내가 쓴 돈 적기' FAB 의 href 는 '/receipt' 다", () => {
    render(<ParticipantFab />)
    expect(screen.getByRole('link', { name: '내가 쓴 돈 적기' })).toHaveAttribute('href', '/receipt')
  })

  it('FAB 는 내비 탭이 아니므로 aria-current 를 갖지 않는다', () => {
    mockUsePathname.mockReturnValue('/calendar')
    render(<ParticipantFab />)
    expect(screen.getByRole('link', { name: '내가 쓴 돈 적기' })).not.toHaveAttribute('aria-current')
  })

  it("pathname 이 '/receipt' 면 FAB 는 렌더하지 않는다(이미 지출 기록 화면 · 중복 제거)", () => {
    mockUsePathname.mockReturnValue('/receipt')
    render(<ParticipantFab />)
    expect(screen.queryByRole('link', { name: '내가 쓴 돈 적기' })).toBeNull()
  })

  it.each(['/supporter', '/admin', '/login'])(
    "pathname 이 '%s' 면 FAB 는 렌더하지 않는다(범위 밖 방어 가드)",
    (path) => {
      mockUsePathname.mockReturnValue(path)
      render(<ParticipantFab />)
      expect(screen.queryByRole('link', { name: '내가 쓴 돈 적기' })).toBeNull()
    }
  )
})
