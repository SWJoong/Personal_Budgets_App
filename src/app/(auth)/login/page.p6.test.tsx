import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoginPage from './page'

/**
 * P6 a11y — 로그인 진입 화면 landmark + skip-link 목적지 (W 작성 · test-first).
 * 설계출처: Plan&Source/goala_p6_a11y_W.md §2(krds §2: 8.1.1 landmark / 6.4.1 skip-link) · §4(Phase A/G).
 *
 * 전역 skip-link 는 src/app/layout.tsx 에서 <a href="#main-content">본문 바로가기</a> 로 상시 렌더된다.
 *   따라서 각 진입 화면은 그 목적지 <main id="main-content"> 를 반드시 제공해야 skip-link 가 살아있고
 *   main 랜드마크로 스크린리더 탐색이 가능하다. 현재 로그인 화면은 div 래퍼만이라 목적지가 없다.
 *
 * 단언 범위: 구조·landmark 만(main#main-content 존재·단일). 토큰/색/레이아웃은 단언하지 않는다.
 * RED 근거(main=b2f47b1): (auth)/login/page.tsx 는 <div className="flex min-h-screen ...">
 *   래퍼만이라 #main-content·role=main 부재 → 아래 단언 실패. U 가 진입 컨테이너를
 *   <main id="main-content"> 로 승격하면 green(force-merge 금물 — 구조 승격으로 초록).
 */

// GoogleLoginContent 는 useSearchParams 를 쓴다(Suspense 내부). 라우터 훅만 스텁.
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}))

// createClient 는 클릭 핸들러에서만 호출되지만 import 해석을 위해 스텁.
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }),
}))

describe('로그인 화면 — main#main-content 목적지 (login/skip-link-target-main)', () => {
  it('전역 skip-link 목적지 #main-content 요소가 존재한다', () => {
    const { container } = render(<LoginPage />)
    // RED: 현재 진입 컨테이너가 div 래퍼라 #main-content 없음 → skip-link '본문 바로가기' 가 죽는다.
    expect(container.querySelector('#main-content')).not.toBeNull()
  })

  it('main 랜드마크가 정확히 1개 존재한다', () => {
    render(<LoginPage />)
    // RED: main 랜드마크 부재 → getByRole('main') throw / querySelectorAll('main').length === 0.
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(document.querySelectorAll('main').length).toBe(1)
  })

  it('#main-content 를 담은 요소가 main 랜드마크다(div 래퍼가 아니라)', () => {
    const { container } = render(<LoginPage />)
    const target = container.querySelector('#main-content')
    // RED: 목적지가 없거나 div 이면 실패 — 목적지는 main 이어야 랜드마크·skip 둘 다 충족.
    expect(target?.tagName.toLowerCase()).toBe('main')
  })
})
