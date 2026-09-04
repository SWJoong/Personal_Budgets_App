import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MoreMenuClient from './MoreMenuClient'

/**
 * P5 IA — 당사자 nav 도달성: /guide · /settings/profile (nav-reachability/*)
 * 설계출처: Plan&Source/goala_p5_ia_W.md §nav-reachability.
 *
 * 목표: 기능하는 당사자 페이지 두 곳이 인바운드 링크 0(orphan)이다 —
 *   /guide(앱 사용 설명서)와 /settings/profile(ProfileEditClient 프로필 편집기).
 *   둘 다 대체 상위 라우트가 없어 redirect 는 기능 삭제가 된다(force-merge 금물) →
 *   redirect 가 아니라 nav 링크 추가로 도달성을 잠근다.
 *
 * 표면: 당사자 '더보기' 메뉴(MoreMenuClient) — W 지정 1안. U 가 여기에 링크를 배선한다.
 *
 * RED 사유: 현재 MoreMenuClient 에 /guide·/settings/profile 링크가 전무 →
 *   getByRole('link', {name}) 가 throw → RED. 링크 추가 시 초록.
 *
 * 훅/모듈 의존: useAccessibility(설정 토글) · supabase client(로그아웃) · useRouter 를 모킹한다
 *   (렌더가 성공해야 '링크 부재' 로 정확히 빨강이 된다 — 렌더 폭발로 인한 위양성 방지).
 * 단언 범위: 행위(링크 존재·href)만. 배치·문구·토큰은 단언하지 않는다.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))

vi.mock('@/hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    fontSize: 'normal', setFontSize: vi.fn(),
    highContrast: false, setHighContrast: vi.fn(),
    easyTerms: false, setEasyTerms: vi.fn(),
    yellowBg: false, setYellowBg: vi.fn(),
    darkMode: false, setDarkMode: vi.fn(),
  }),
}))

describe('nav-reachability/guide — 더보기 메뉴에 앱 사용 안내 링크', () => {
  it("'/guide' 로 가는 링크가 더보기 메뉴에 존재한다", () => {
    render(<MoreMenuClient fileLinks={[]} />)
    // RED: 현재 어떤 nav 에도 /guide 링크 부재 → getByRole throw.
    //   기능하는 앱 사용 설명서이나 인바운드 링크 0(login 의 'guide' 매치는 인용문일 뿐 링크 아님).
    //   redirect 금지(대체 상위 라우트 없음) — 링크 추가로 초록(force-merge 금물).
    const link = screen.getByRole('link', { name: /이용 안내|사용 안내|가이드|안내|설명서|도움말/ })
    expect(link).toHaveAttribute('href', '/guide')
  })
})

describe('nav-reachability/settings-profile — 더보기 메뉴에 프로필 편집 링크', () => {
  it("'/settings/profile' 로 가는 링크가 더보기/설정 메뉴에 존재한다", () => {
    render(<MoreMenuClient fileLinks={[]} />)
    // RED: 현재 /settings/profile 로 가는 렌더 링크 전무 → getByRole throw.
    //   ProfileEditClient 프로필 편집기이며 이를 대체하는 다른 프로필-편집 라우트가 없다
    //   → redirect 시 기능 소실. 링크 추가로 초록.
    const link = screen.getByRole('link', { name: /내 정보|프로필|정보 수정/ })
    expect(link).toHaveAttribute('href', '/settings/profile')
  })
})
