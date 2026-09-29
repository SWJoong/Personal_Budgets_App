import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'

/**
 * P6 Phase C — AdminSidebar 하위메뉴 토글 44px·이름 있는 라벨 + 장식 이모지 (f13f641 B4·A6 재적용)
 * 출처: feat/kwcag-a11y-foundation f13f641 + docs/a11y/phase-c-plan.md 「실행 현황」 §8 잔여
 *   ('하위메뉴 토글 28px→44px·이름 있는 라벨').
 *
 * - 하위메뉴 토글: 'w-7 h-7'(28px) → 44px. 라벨 '펼치기'/'접기' 만으로는 어느 메뉴인지 모름(여러 개가
 *   같은 이름) → '<메뉴이름> 하위 메뉴 펼치기/접기'. 펼쳤을 때만 aria-controls 가 서브 영역 id 를 가리킨다
 *   (접힘 = 속성 없음). id 는 useId 접두로 인스턴스마다 달라 데스크톱+모바일 드로어 동시 마운트에도 겹치지 않는다
 *   (#201 검증 돌연변이 M6 '항상 부여'·M7 'useId 접두 제거' 생존 → 보강).
 * - 활성 경로라 자동으로 펼쳐진 항목도 첫 클릭에 접힌다(예전엔 첫 클릭 무반응 — aria-expanded 고착).
 * - 서브·빠른 설정 링크의 앞 이모지(➕📋…), '빠른 설정' ⚡·▲▼, 로그아웃 🚪 는 장식 → 접근명에서 빠진다.
 *   접힘 모드 로그아웃은 보이는 글자가 없어 aria-label='로그아웃' 로 이름을 준다.
 *
 * 접기 토글 44px·nav landmark·aria-current 는 AdminSidebar.p6c/test 가 이미 커버 → 재단언하지 않는다.
 * 렌더 게이트: usePathname/useAuth 모킹(user=null → role 불명 = 관리자 전체 메뉴).
 */
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/admin'),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, supabase: { auth: { signOut: vi.fn() } } }),
}))

const TOUCH_H = /(?:^|\s)(?:min-h-11|min-h-\[44px\]|h-11)(?:\s|$)/
const TOUCH_W = /(?:^|\s)(?:min-w-11|min-w-\[44px\]|w-11)(?:\s|$)/

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue('/admin')
})

describe('P6-C touch44 — AdminSidebar 하위메뉴 토글 (adminsidebar-submenu-touch-label)', () => {
  it('하위메뉴 토글마다 메뉴 이름이 든 라벨과 가로·세로 44px 터치 클래스를 가진다', () => {
    render(<AdminSidebar />)
    for (const name of ['당사자 관리', '신청 · 선정']) {
      const toggle = screen.getByRole('button', { name: `${name} 하위 메뉴 펼치기` })
      expect(toggle.className).toMatch(TOUCH_H)
      expect(toggle.className).toMatch(TOUCH_W)
      expect(toggle.className).not.toMatch(/(?:^|\s)(?:w-7|h-7)(?:\s|$)/)
    }
  })

  it('펼치면 라벨이 접기로 바뀌고 aria-controls 가 서브 링크를 담은 영역을 가리킨다', async () => {
    const user = userEvent.setup()
    render(<AdminSidebar />)
    const toggle = screen.getByRole('button', { name: '당사자 관리 하위 메뉴 펼치기' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // 접혔을 땐 서브 영역이 DOM 에 없다 → aria-controls 가 있으면 없는 IDREF 를 가리킨다(펼쳤을 때만 부여)
    expect(toggle).not.toHaveAttribute('aria-controls')

    await user.click(toggle)
    expect(toggle).toHaveAccessibleName('당사자 관리 하위 메뉴 접기')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const id = toggle.getAttribute('aria-controls')
    expect(id).toBeTruthy()
    const region = document.getElementById(id!)
    expect(region).not.toBeNull()
    expect(region!.querySelector('a[href="/admin/participants/new"]')).not.toBeNull()
  })

  it('활성 경로로 자동 펼쳐진 하위메뉴도 첫 클릭에 접힌다', async () => {
    vi.mocked(usePathname).mockReturnValue('/admin/participants')
    const user = userEvent.setup()
    render(<AdminSidebar />)
    const toggle = screen.getByRole('button', { name: '당사자 관리 하위 메뉴 접기' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAccessibleName('당사자 관리 하위 메뉴 펼치기')
    expect(screen.queryByRole('link', { name: '당사자 등록' })).toBeNull()
    // 접은 뒤엔 aria-controls 도 빠진다(사라진 영역을 가리키지 않게)
    expect(toggle).not.toHaveAttribute('aria-controls')
  })

  it('두 인스턴스(데스크톱 사이드바 + 모바일 드로어)가 함께 떠도 하위메뉴 id 가 겹치지 않고 각자 자기 영역을 가리킨다', async () => {
    // SupporterLayoutClient 는 데스크톱(hidden md:flex — DOM 에 남음)과 모바일 드로어에 AdminSidebar 를 동시에 마운트한다.
    const user = userEvent.setup()
    render(
      <>
        <AdminSidebar />
        <AdminSidebar />
      </>,
    )
    const toggles = screen.getAllByRole('button', { name: '당사자 관리 하위 메뉴 펼치기' })
    expect(toggles).toHaveLength(2)
    for (const t of toggles) await user.click(t)

    const ids = toggles.map((t) => {
      expect(t).toHaveAttribute('aria-expanded', 'true')
      const id = t.getAttribute('aria-controls')
      expect(id).toBeTruthy()
      return id!
    })
    expect(ids[0]).not.toBe(ids[1])

    for (const [i, t] of toggles.entries()) {
      // 같은 id 를 가진 요소가 문서 전체에 정확히 1개(중복 id = 마크업 오류·오참조)
      const same = Array.from(document.querySelectorAll('[id]')).filter((el) => el.id === ids[i])
      expect(same).toHaveLength(1)
      // 가리키는 영역이 자기 인스턴스(aside) 안에 있고, 서브 링크를 담는다
      const aside = t.closest('aside')
      expect(aside).not.toBeNull()
      expect(aside!.contains(same[0])).toBe(true)
      expect(same[0].querySelector('a[href="/admin/participants/new"]')).not.toBeNull()
    }
  })
})

describe('P6-C 장식 이모지 — AdminSidebar 링크·버튼 접근명 (adminsidebar-emoji-hidden)', () => {
  it('하위메뉴 링크 접근명에 앞 이모지가 없다(글자만)', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/participants')
    render(<AdminSidebar />)
    // exact 문자열 — '➕ 당사자 등록' 이면 실패
    expect(screen.getByRole('link', { name: '당사자 등록' })).toHaveAttribute('href', '/admin/participants/new')
    expect(screen.getByText('➕').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("'빠른 설정' 버튼 접근명은 글자만이고, 펼친 빠른 링크도 이모지 없이 읽힌다", async () => {
    const user = userEvent.setup()
    render(<AdminSidebar />)
    const quick = screen.getByRole('button', { name: '빠른 설정' })
    await user.click(quick)
    expect(screen.getByRole('link', { name: '초대 관리' })).toHaveAttribute('href', '/admin/invitations')
    expect(screen.getByRole('link', { name: '영수증 검토' })).toHaveAttribute('href', '/supporter/review')
  })

  it("로그아웃 버튼은 펼침·접힘 모두 접근명이 '로그아웃'(🚪 는 장식)", () => {
    const { unmount } = render(<AdminSidebar />)
    // 펼침: 보이는 글자 '로그아웃' 이 이름(aria-label 을 덧씌우지 않음 — 보이는 라벨과 일치)
    const open = screen.getByRole('button', { name: '로그아웃' })
    expect(open).not.toHaveAttribute('aria-label')
    unmount()
    render(<AdminSidebar collapsed onToggle={() => {}} />)
    // 접힘: 보이는 글자가 없어(🚪 는 aria-hidden) title 만으론 이름이 약하다(title 은 accname 최후 대체·
    // 터치기기 미노출) → aria-label 을 명시. title 폴백과 구별하려고 속성 자체를 단언한다.
    const collapsedBtn = screen.getByRole('button', { name: '로그아웃' })
    expect(collapsedBtn).toHaveAttribute('aria-label', '로그아웃')
    expect(screen.getByText('🚪').closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
