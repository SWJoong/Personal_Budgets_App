import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminDashboardCards from './AdminDashboardCards'

/**
 * G1 관리자 대시보드 보강 — 상태카운트 + 빠른실행 그리드 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_admin_dashboard_G1_W.md.
 * 구현 대상: src/app/(supporter)/admin/AdminDashboardCards.tsx (신규 프리젠테이션 컴포넌트).
 *
 * 배경: /admin 은 그동안 participantCount 하나 + 빠른실행 2링크뿐(희소). 오늘 할 일(검토/심사/
 *   심의 대기) 실시간 카운트 카드와 자주 쓰는 운영화면 그리드를 붙인다. 카운트는 각 워크리스트
 *   pending 필터와 일치(검토=rule_checks pending distinct usage·심사=applications received/screening·
 *   심의=plans submitted/under_review). 이 컴포넌트는 props 만 받는 정적 프리젠테이션.
 *
 * RED 사유: AdminDashboardCards 가 아직 없다.
 * 단언 범위: 노출·링크·카운트만(배치·토큰·정확문구 제외).
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string | { pathname?: string }; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : (href?.pathname ?? '#')} {...rest}>
      {children}
    </a>
  ),
}))

function renderCards(overrides: Partial<React.ComponentProps<typeof AdminDashboardCards>> = {}) {
  const props = {
    name: '데모 관리자',
    participantCount: 10,
    pending: { review: 3, screening: 2, planReview: 1 },
    ...overrides,
  }
  return render(<AdminDashboardCards {...props} />)
}

describe('G1 — AdminDashboardCards 상태카운트 + 그리드', () => {
  it('히어로에 관리자 이름과 당사자 수를 보여준다', () => {
    renderCards()
    expect(screen.getByText(/데모 관리자/)).toBeInTheDocument()
    expect(screen.getByText(/10/)).toBeInTheDocument()
  })

  it('검토 대기 카드: 카운트 + /supporter/review 링크', () => {
    renderCards()
    const link = screen.getByRole('link', { name: /검토 대기/ })
    expect(link).toHaveAttribute('href', '/supporter/review')
    expect(link).toHaveTextContent('3')
  })

  it('심사 대기 카드: 카운트 + /supporter/applications 링크', () => {
    renderCards()
    const link = screen.getByRole('link', { name: /심사 대기/ })
    expect(link).toHaveAttribute('href', '/supporter/applications')
    expect(link).toHaveTextContent('2')
  })

  it('심의 대기 카드: 카운트 + /supporter/plans 링크', () => {
    renderCards()
    const link = screen.getByRole('link', { name: /심의 대기/ })
    expect(link).toHaveAttribute('href', '/supporter/plans')
    expect(link).toHaveTextContent('1')
  })

  it('빠른실행 그리드에 복원된 회계·서류 화면 링크가 있다', () => {
    const { container } = renderCards()
    for (const href of ['/supporter/transactions', '/supporter/settlements', '/supporter/documents']) {
      expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull()
    }
  })

  it('pending 이 전부 0 이어도 카드가 0 으로 렌더된다(대시보드 깨지지 않음)', () => {
    renderCards({ pending: { review: 0, screening: 0, planReview: 0 } })
    const link = screen.getByRole('link', { name: /검토 대기/ })
    expect(link).toHaveTextContent('0')
  })
})
