import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingClient from './OnboardingClient'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'

/**
 * P6 온보딩 계약 — Phase A(landmark/heading) + Phase B(그룹 선택자·라벨/필수) 통합판.
 * 설계출처: Plan&Source/goala_p6_a11y_W.md §2(krds §2: 8.1.1 landmark / 6.4.1 skip-link /
 *   heading 레벨 시퀀스) + Plan&Source/goala_p6_phaseB_W.md §FormField/그룹 선택자 설계결정.
 *
 * Phase A(#103 머지)로 main#main-content landmark·profile 스텝 h1 은 이미 green → 회귀 가드.
 * Phase B onboarding 계약은 전부 GUARD/DESIGN-DOC(이미 green, onboarding 엔 하드 RED 없음):
 *   [GUARD] 단일선택 그룹은 fieldset/legend + aria-pressed 토글, 이름 aria-required.
 *   [DESIGN-DOC] 빈 이름 제출은 disabled 가드로 막혀 nameError→aria-invalid 경로 휴면(관측잠금).
 *   [DESIGN-DOC] 그룹을 role=radiogroup 로 바꿀지 vs aria-pressed 토글 유지는 W 결정 →
 *     현행 토글 유지, radiogroup 전환은 P7 폴리시 이관(하드 RED 미부착).
 *
 * 두 웨이브의 render/props 를 각자 보존(통합은 imports·mocks 병합만) → 각 describe 는 격리판과 동일 조건.
 * 단언 범위: 구조·landmark·heading·라벨/ARIA 만. 토큰/색은 단언하지 않는다.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: () => ({
      select: () => ({ eq: () => ({ single: vi.fn() }) }),
      insert: async () => ({ error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}))

// ── Phase A: landmark/heading — 빈 선택지 + 이름 프리필 ────────────────
const propsLandmark = {
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
      <OnboardingClient {...propsLandmark} />
    </LiveRegionProvider>,
  )
}

// ── Phase B: 그룹 선택자/라벨 — populated 선택지 + 빈 이름 ─────────────
const propsChooser = {
  userId: 'u1',
  userEmail: 'jisu@example.com',
  userName: '',
  userAvatar: '',
  supporters: [{ id: 's1', name: '박지원', avatar_url: null }],
  participants: [{ id: 'p1', name: '김지수', avatar_url: null }],
}

function renderClient() {
  return render(
    <LiveRegionProvider>
      <OnboardingClient {...propsChooser} />
    </LiveRegionProvider>,
  )
}

// ═══ Phase A — landmark + heading 시퀀스 (이미 green, 회귀 가드) ═══════
describe('온보딩 화면 — main#main-content 목적지 (onboarding/skip-link-target-main)', () => {
  it('전역 skip-link 목적지 #main-content 요소가 존재한다', () => {
    const { container } = renderOnboarding()
    expect(container.querySelector('#main-content')).not.toBeNull()
  })

  it('main 랜드마크가 정확히 1개 존재한다', () => {
    renderOnboarding()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(document.querySelectorAll('main').length).toBe(1)
  })
})

describe('온보딩 화면 — heading 레벨 시퀀스 (onboarding/heading-level-sequence)', () => {
  it("초기 'role' 스텝은 h1 이 정확히 1개다", () => {
    renderOnboarding()
    // h1('반가워요!') baseline — 회귀 가드.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it("'profile' 스텝으로 이동해도 h1 이 정확히 1개 유지된다", async () => {
    const user = userEvent.setup()
    renderOnboarding()
    // 지원자 역할 선택 → profile 스텝 진입.
    await user.click(screen.getByRole('button', { name: /당사자의 예산 관리를 지원해요/ }))
    // #103 로 profile 스텝 제목이 h1 로 승격됨 → 회귀 가드.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

// ═══ Phase B — 그룹 선택자 + 라벨/필수 (GUARD/DESIGN-DOC, 이미 green) ═══
// 역할 선택 → 프로필 단계로 진입(이름 FormField 가 나오는 단계).
function goToProfile() {
  fireEvent.click(screen.getByRole('button', { name: /예산을 직접 관리/ }))
}

describe('OnboardingClient p6 소비자 — 그룹 선택자 + 라벨/필수', () => {
  it('[DESIGN-DOC 관측] 빈 이름일 때 제출 버튼이 disabled 라 nameError→aria-invalid 경로가 휴면이다', () => {
    renderClient()
    goToProfile()
    // 빈 이름 → 제출 버튼 disabled → 클릭해도 handleComplete 미실행 → aria-invalid 미발생.
    // (이 사실을 잠가 두어, disabled 가드를 제거하면 이 계약이 깨지며 W 설계결정을 환기시킨다.)
    expect(screen.getByRole('button', { name: /시작하기/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /시작하기/ }))
    expect(screen.getByLabelText(/이름/)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('[GUARD] 단일선택 그룹은 fieldset/legend 로 묶이고 aria-pressed 토글버튼을 쓴다', () => {
    const { container } = renderClient()
    goToProfile()
    // 최소 하나의 legend(그룹 이름)와 aria-pressed 토글이 존재.
    expect(container.querySelector('fieldset legend')).not.toBeNull()
    expect(container.querySelectorAll('[aria-pressed]').length).toBeGreaterThan(0)
  })

  it('[GUARD] 이름 입력이 label 로 도달되고 aria-required 를 갖는다', () => {
    renderClient()
    goToProfile()
    const name = screen.getByLabelText(/이름/)
    expect(name).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-required', 'true')
    // 프로필 단계 heading 이 존재(문서 구조 회귀잠금).
    expect(screen.getByRole('heading', { name: /프로필 설정/ })).toBeInTheDocument()
    // within 사용 예시로 legend 그룹 내부 토글 접근 가능성 확인(스모크).
    const fs = document.querySelector('fieldset') as HTMLElement
    expect(within(fs).getAllByRole('button').length).toBeGreaterThan(0)
  })
})
