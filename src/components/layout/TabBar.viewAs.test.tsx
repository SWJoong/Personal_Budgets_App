import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, waitFor } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { VIEW_AS_ID_COOKIE } from '@/utils/viewAsCookies'
import { TabBar } from './TabBar'

/**
 * TabBar — 관리자 둘러보기(view-as) 중 당사자 탭 강제 계약 (W 작성 · 독립 계약 테스트).
 * 설계출처: TabBar.tsx 주석 — view-as 중이면 '실제 역할(admin)과 무관하게' 당사자 탭을 보인다.
 *           지금 보고 있는 화면이 당사자 화면이므로 하단 내비도 그에 맞춰야 일관적이다.
 *
 * ★기존 TabBar.test.tsx(4탭 구조 계약, useAuth=user:null)와 분리된 신규 파일 — 여기선 '실제 admin
 *   세션' 을 모킹해 두 축(실제 역할 vs view-as 표시)이 갈라지는 지점을 가둔다(충돌 없음).
 *
 * 스펙(대조 설계):
 *  - view-as 쿠키 있음 + 실제 admin → 당사자 탭(달력/계획 존재, 관리자 전용 '당사자 관리' 부재).
 *  - view-as 쿠키 없음 + 실제 admin → 관리자 탭('당사자 관리' 존재, 당사자 전용 '달력' 부재).
 *
 * 훅 의존: usePathname('/') + useAuth(admin 유저). TabBar 는 useAuth.supabase 로 profiles.role 을
 *   비동기 조회하므로, 관리자 탭 확정은 findBy/waitFor 로 기다린다.
 * 단언 범위: 행위·구조(탭 링크 존재/부재)만. 색상/토큰/픽셀은 단언하지 않는다.
 */

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

// 실제 admin 세션: user 존재 + profiles.role='admin' 을 반환하는 supabase 스텁.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1' },
    loading: false,
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { role: 'admin' } }),
          }),
        }),
      }),
    },
  }),
}))

const mockUsePathname = vi.mocked(usePathname)

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`
}
function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/')
  clearCookie(VIEW_AS_ID_COOKIE)
})

afterEach(() => {
  cleanup()
  clearCookie(VIEW_AS_ID_COOKIE)
})

describe('TabBar — view-as 중 당사자 탭 강제 계약 (tabbar-viewas-forces-participant)', () => {
  it('★view-as 쿠키가 있으면 실제 admin 이라도 당사자 탭을 보인다(달력·계획 존재, 관리자 탭 부재)', async () => {
    setCookie(VIEW_AS_ID_COOKIE, '11e95b8b-6806-496d-9f36-88bd04e814b3')
    render(<TabBar />)

    const nav = screen.getByRole('navigation', { name: '메인 네비게이션' })
    // 당사자 전용 탭이 나타난다(쿠키 effect 반영 대기).
    await waitFor(() => {
      expect(within(nav).queryByRole('link', { name: /달력/ })).not.toBeNull()
    })
    expect(within(nav).getByRole('link', { name: /달력/ })).toHaveAttribute('href', '/calendar')
    expect(within(nav).getByRole('link', { name: /계획/ })).toHaveAttribute('href', '/plan')
    // 관리자 전용 진입점은 미리보기 중 새어 나오면 안 된다.
    expect(within(nav).queryByRole('link', { name: /당사자 관리/ })).toBeNull()
  })

  it('view-as 쿠키가 없으면 실제 admin 은 관리자 탭을 본다 (대조군: 당사자 관리 존재, 달력 부재)', async () => {
    // 쿠키 없음 — 실제 역할(admin)이 그대로 반영돼야 view-as 강제가 '쿠키에 의한 것' 임이 증명된다.
    render(<TabBar />)

    const nav = screen.getByRole('navigation', { name: '메인 네비게이션' })
    // 역할은 비동기 조회 → 관리자 탭 출현을 기다린다.
    const adminLink = await within(nav).findByRole('link', { name: /당사자 관리/ })
    expect(adminLink).toHaveAttribute('href', '/admin/participants')
    // 관리자 탭 세트엔 당사자 전용 '달력' 이 없다.
    expect(within(nav).queryByRole('link', { name: /달력/ })).toBeNull()
  })
})
