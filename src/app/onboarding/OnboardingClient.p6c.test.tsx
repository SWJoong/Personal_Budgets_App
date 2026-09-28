import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingClient from './OnboardingClient'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'

/**
 * P6 Phase C — 온보딩 장식 이모지 aria-hidden (f13f641 A6-content 재적용)
 * 출처: feat/kwcag-a11y-foundation f13f641 — 👋·역할카드 🙋🤝·뒤로 ←·프로필 제목 이모지.
 *   같은 파일의 남은 장식(📷·💰·선택 ✓·'시작하기 🎉')도 함께 숨긴다.
 *
 * 단언: (1) 두 스텝 모두 렌더된 이모지 글자가 aria-hidden 아래에 있다. (2) 버튼 접근명에 이모지가 섞이지 않는다
 *   (역할 카드·재원 선택·제출). 선택 표시 ✓ 는 aria-pressed 가 상태를 전달하므로 이름에서 빠진다.
 * 모킹: OnboardingClient.p6.test.tsx 와 같은 router·supabase. landmark/heading/FormField 는 p6 가 소유 → 재단언 안 함.
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

const EMOJI = /\p{Extended_Pictographic}/u

/** 스크린리더에 그대로 노출되는 이모지 텍스트 — aria-hidden 조상도, aria-label 로 이름이 덮인 컨트롤 조상도 없는 것. */
function exposedEmoji(root: HTMLElement): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? ''
    if (!EMOJI.test(text)) continue
    const el = n.parentElement!
    if (el.closest('[aria-hidden="true"]')) continue
    if (el.closest('button[aria-label], a[aria-label]')) continue
    out.push(text.trim())
  }
  return out
}

function renderClient(participants: { id: string; name: string | null; avatar_url: string | null }[] = []) {
  return render(
    <LiveRegionProvider>
      <OnboardingClient
        userId="u1"
        userEmail="jisu@example.com"
        userName="김지수"
        userAvatar=""
        supporters={[{ id: 's1', name: '박지원', avatar_url: null }]}
        participants={participants}
      />
    </LiveRegionProvider>,
  )
}

describe('P6-C 장식 이모지 — 온보딩 역할 선택 (onboarding-role-emoji-hidden)', () => {
  it('역할 스텝에 스크린리더로 노출되는 이모지가 없다(👋·🙋·🤝)', () => {
    const { container } = renderClient()
    expect(exposedEmoji(container)).toEqual([])
    expect(screen.getByText('👋').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('역할 카드 버튼 접근명이 이모지로 시작하지 않는다', () => {
    renderClient()
    const card = screen.getByRole('button', { name: /예산을 직접 관리/ })
    expect(card).not.toHaveAccessibleName(/🙋/u)
  })
})

describe('P6-C 장식 이모지 — 온보딩 프로필 설정 (onboarding-profile-emoji-hidden)', () => {
  it('프로필 스텝(당사자)에 스크린리더로 노출되는 이모지가 없다(📷·💰·✓·🎉 포함)', async () => {
    const user = userEvent.setup()
    const { container } = renderClient()
    await user.click(screen.getByRole('button', { name: /예산을 직접 관리/ }))
    // 담당 지원자를 골라 선택 표시 ✓ 까지 렌더
    await user.click(screen.getByRole('button', { name: /박지원/ }))
    const picked = screen.getByRole('button', { name: /박지원/ })
    expect(picked).toHaveAttribute('aria-pressed', 'true')
    // ✓ 는 이모지 범주 밖이라 따로 — 선택 상태는 aria-pressed 가 전달하므로 이름에 섞이지 않는다
    expect(picked).not.toHaveAccessibleName(/✓/)
    expect(exposedEmoji(container)).toEqual([])
  })

  it('프로필 스텝(지원자)에서 담당 당사자 선택 표시 ✓ 는 aria-hidden 이라 버튼 이름에 섞이지 않는다', async () => {
    // 지원자 경로는 당사자 목록이 있어야 그려진다 — 당사자 경로 ✓ 와 별개의 렌더 가지(#201 검증 돌연변이 P3 생존 → 보강)
    const user = userEvent.setup()
    const { container } = renderClient([{ id: 'p1', name: '김지수', avatar_url: null }])
    await user.click(screen.getByRole('button', { name: /당사자의 예산 관리를 지원해요/ }))
    await user.click(screen.getByRole('button', { name: /김지수/ }))
    const picked = screen.getByRole('button', { name: /김지수/ })
    expect(picked).toHaveAttribute('aria-pressed', 'true')
    // ✓(U+2713)는 Extended_Pictographic 밖이라 exposedEmoji 가 못 잡는다 → 이름·aria-hidden 을 직접 단언
    expect(picked).not.toHaveAccessibleName(/✓/)
    expect(screen.getByText('✓').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(exposedEmoji(container)).toEqual([])
  })

  it('재원 선택·제출 버튼 접근명은 글자만이다', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole('button', { name: /예산을 직접 관리/ }))
    expect(screen.getByRole('button', { name: '재원 하나' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '둘 이상' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument()
  })

  it("'뒤로' 버튼의 ← 는 aria-hidden 이다(접근명은 aria-label '뒤로 가기')", async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole('button', { name: /예산을 직접 관리/ }))
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument()
    expect(screen.getByText('←').closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
