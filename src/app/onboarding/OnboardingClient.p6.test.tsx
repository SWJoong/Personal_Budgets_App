import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingClient from './OnboardingClient'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'

/**
 * P6 a11y — 온보딩 진입 화면 landmark + heading 계층 (W 작성 · test-first).
 * 설계출처: Plan&Source/goala_p6_a11y_W.md §2(krds §2: 8.1.1 landmark / 6.4.1 skip-link /
 *   heading 레벨 시퀀스) · §4(Phase A/G).
 *
 * (1) skip-link 목적지: 전역 <a href="#main-content"> 가 살아있으려면 이 화면도 main#main-content 제공.
 * (2) heading 계층: 각 스텝(화면 상태)은 정확히 1개의 h1 을 가져야 SR heading 탐색이 붕괴하지 않는다.
 *     현재 'role' 스텝은 h1('반가워요!')이 있으나, 'profile' 스텝은 h2 로 시작(h1 부재) → 레벨 도약.
 *
 * 훅 의존: useRouter·supabase client 스텁 + 실 LiveRegionProvider(useToast 컨텍스트) 래핑.
 * 단언 범위: 구조·landmark·heading 만. 토큰/색은 단언하지 않는다.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: () => ({ select: () => ({ eq: () => ({ single: vi.fn() }) }) }),
  }),
}))

const props = {
  userId: 'u-1',
  userEmail: 'u@example.com',
  userName: '홍길동',
  userAvatar: '',
  supporters: [],
  participants: [],
}

function renderOnboarding() {
  return render(
    <LiveRegionProvider>
      <OnboardingClient {...props} />
    </LiveRegionProvider>,
  )
}

describe('온보딩 화면 — main#main-content 목적지 (onboarding/skip-link-target-main)', () => {
  it('전역 skip-link 목적지 #main-content 요소가 존재한다', () => {
    const { container } = renderOnboarding()
    // RED: 진입 컨테이너가 div 래퍼라 #main-content 부재 → skip-link 죽음.
    expect(container.querySelector('#main-content')).not.toBeNull()
  })

  it('main 랜드마크가 정확히 1개 존재한다', () => {
    renderOnboarding()
    // RED: main 랜드마크 부재.
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(document.querySelectorAll('main').length).toBe(1)
  })
})

describe('온보딩 화면 — heading 레벨 시퀀스 (onboarding/heading-level-sequence)', () => {
  it("초기 'role' 스텝은 h1 이 정확히 1개다", () => {
    renderOnboarding()
    // 현재도 h1('반가워요!')이 있어 이 케이스는 baseline(green) — 회귀 가드.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it("'profile' 스텝으로 이동해도 h1 이 정확히 1개 유지된다", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    // 지원자 역할 선택 → profile 스텝 진입.
    await user.click(screen.getByRole('button', { name: /당사자의 예산 관리를 지원해요/ }))
    // RED: profile 스텝은 '프로필 설정' 이 h2 로 시작(h1 부재) → h1 개수 0 → 레벨 도약.
    //   U 가 스텝 제목을 h1 으로 승격(또는 화면 상단 h1 유지)하면 green.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
