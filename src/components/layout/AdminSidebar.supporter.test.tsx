/* eslint-disable jsx-a11y/aria-role -- 여기 <AdminSidebar role="supporter"> 의 role 은 컴포넌트
   prop(UserRole)이지 ARIA role 속성이 아니다. jsx-a11y/aria-role 이 이를 무효 ARIA role 로 오탐한다. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'

/**
 * AdminSidebar — 실무자(supporter) 死링크 분기 계약 (W 작성 · 특성화/회귀보호).
 * 스펙출처: AdminSidebar.tsx 주석(08 QA finding, 사용자 결정 A) — 실무자에게 requireAdmin(/admin/*)
 *   링크를 주면 눌러도 '/' 로 튕기는 死링크가 된다. role 기반으로 adminOnly 항목을 숨기고
 *   접근 가능한 '당사자 현황'(/supporter/participants)으로 대체한다. 브랜드/roleLabel 도 role 기반.
 *
 * 핵심: role prop 을 주면 첫 렌더부터 그 role 로 분기(비동기 조회 skip) → 결정적으로 검증 가능.
 * 모킹: 기존 AdminSidebar.test.tsx 와 동일(next/navigation usePathname · @/hooks/useAuth).
 *   role 은 prop 으로 주입하므로 useAuth 의 user 는 null 이어도 무관(분기는 prop 이 결정).
 * 단언 범위: 링크 노출/부재·href·roleLabel(死링크 제거 계약). 토큰/색/배치는 단언하지 않는다.
 */

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/supporter'),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, supabase: { auth: { signOut: vi.fn() } } }),
}))

const mockUsePathname = vi.mocked(usePathname)

beforeEach(() => {
  mockUsePathname.mockReturnValue('/supporter')
})

// 현재 렌더된 모든 링크의 href 목록(死링크 누수 검사용)
const hrefs = () => screen.queryAllByRole('link').map((l) => l.getAttribute('href') ?? '')

describe('AdminSidebar — role="supporter": /admin 死링크가 하나도 새지 않는다', () => {
  it('렌더된 어떤 링크도 /admin 으로 시작하지 않는다(그리고 링크는 실제로 존재한다)', () => {
    render(<AdminSidebar role="supporter" />)
    const all = hrefs()
    expect(all.length).toBeGreaterThan(0) // 빈 렌더로 인한 공허한 통과 방지
    for (const h of all) {
      expect(h.startsWith('/admin')).toBe(false)
    }
  })

  it('adminOnly 메뉴(관리자 대시보드·당사자 관리·시스템 설정)가 노출되지 않는다', () => {
    render(<AdminSidebar role="supporter" />)
    expect(screen.queryByRole('link', { name: /관리자 대시보드/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /^당사자 관리$/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /시스템 설정/ })).toBeNull()
    // href 로도 부재 확인 — /admin, /admin/participants, /admin/settings
    expect(hrefs()).not.toContain('/admin')
    expect(hrefs()).not.toContain('/admin/participants')
    expect(hrefs()).not.toContain('/admin/settings')
  })
})

describe('AdminSidebar — role="supporter": 접근 가능한 대체 링크·브랜드·라벨', () => {
  it("'당사자 현황' 링크가 존재하고 href=/supporter/participants", () => {
    render(<AdminSidebar role="supporter" />)
    const link = screen.getByRole('link', { name: '당사자 현황' })
    expect(link).toHaveAttribute('href', '/supporter/participants')
  })

  it('브랜드(앱명) 링크 href=/supporter, roleLabel=담당자', () => {
    render(<AdminSidebar role="supporter" />)
    const brand = screen.getByRole('link', { name: /서울형 개인예산제/ })
    expect(brand).toHaveAttribute('href', '/supporter')
    expect(brand).toHaveTextContent('담당자')
  })
})

describe('AdminSidebar — role="supporter": 빠른 설정 퀵 항목도 adminOnly 필터', () => {
  it('펼쳐도 /admin 퀵(당사자 등록/목록/피드백/초대)이 새지 않고, 비-admin 퀵은 노출된다', async () => {
    const user = userEvent.setup()
    render(<AdminSidebar role="supporter" />)

    // 펼치기 전: 퀵 전용 링크(/supporter/applications/new = 메뉴 서브는 접힘)는 아직 미렌더
    expect(hrefs()).not.toContain('/supporter/applications/new')

    await user.click(screen.getByRole('button', { name: /빠른 설정/ }))

    // 펼친 뒤: 비-adminOnly 퀵(신청서 접수)이 보여 패널이 실제로 열렸음을 확인
    expect(hrefs()).toContain('/supporter/applications/new')
    // 그럼에도 /admin/* 퀵은 하나도 없다
    for (const h of hrefs()) {
      expect(h.startsWith('/admin')).toBe(false)
    }
    // 오직 퀵에만 존재하는 adminOnly href 가 확실히 부재(피드백·초대 관리)
    expect(hrefs()).not.toContain('/admin/feedback')
    expect(hrefs()).not.toContain('/admin/invitations')
  })
})

describe('AdminSidebar — 대조: role="admin"/미지정은 관리자 전체 메뉴 유지', () => {
  it('role="admin" 이면 /admin 메뉴 노출, 브랜드 href=/admin, roleLabel=관리자', () => {
    mockUsePathname.mockReturnValue('/admin')
    render(<AdminSidebar role="admin" />)

    expect(screen.getByRole('link', { name: /관리자 대시보드/ })).toHaveAttribute('href', '/admin')
    expect(hrefs()).toContain('/admin/participants') // 당사자 관리
    expect(hrefs()).toContain('/admin/settings') // 시스템 설정

    const brand = screen.getByRole('link', { name: /서울형 개인예산제/ })
    expect(brand).toHaveAttribute('href', '/admin')
    expect(brand).toHaveTextContent('관리자')
  })

  it('role 미지정(prop 없음·user=null) 이어도 관리자 전체 메뉴 노출(기존 단위 계약 정합)', () => {
    mockUsePathname.mockReturnValue('/admin')
    render(<AdminSidebar />)

    expect(screen.getByRole('link', { name: /관리자 대시보드/ })).toHaveAttribute('href', '/admin')
    expect(hrefs()).toContain('/admin/settings')

    const brand = screen.getByRole('link', { name: /서울형 개인예산제/ })
    expect(brand).toHaveAttribute('href', '/admin')
    expect(brand).toHaveTextContent('관리자')
  })

  it('role="participant" 면 roleLabel=당사자', () => {
    render(<AdminSidebar role="participant" />)
    const brand = screen.getByRole('link', { name: /서울형 개인예산제/ })
    expect(brand).toHaveTextContent('당사자')
  })
})
