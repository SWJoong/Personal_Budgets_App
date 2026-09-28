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

/**
 * #201 검증 조건(a11y-copy-2) + 사용자 결정(2026-09-28) — 역할 선택 화면의 '나중에 바꿀 수 있어요' 안내.
 * 사실: 사용자/지원자 역할은 **관리자만** 바꿀 수 있다. supabase/seoul/01_core.sql 의 BEFORE UPDATE 트리거
 *   protect_profile_role() 가 관리자가 아닌 사람의 profiles.role 변경을 조용히 원래 값으로 되돌린다.
 *   그래서 '내 정보'(/settings/profile)에서 역할을 바꿔 저장해도 성공처럼 보이지만 아무것도 바뀌지 않고,
 *   지원자 화면에는 '더보기'(/more)로 가는 링크도 없다. 즉 옛 안내("'더보기'의 '내 정보'에서 바꿀 수 있어요",
 *   그 전엔 없는 메뉴 '계정 관리 →')는 둘 다 스스로 바꿀 수 있다는 거짓 약속이었다.
 * 결정 문구(정확히 이 문장): "잘못 골랐어도 괜찮아요. 관리자에게 바꿔 달라고 말해 주세요."
 * 단언: (1) 결정 문구 그대로. (2) '내 정보'/'더보기'에서 스스로 바꿀 수 있다고 말하지 않고, 없는 메뉴 '계정 관리'와
 *   스크린리더가 '오른쪽 화살표'로 읽는 → 도 쓰지 않는다.
 * 옛 교차 렌더 단언(더보기의 /settings/profile 링크 이름 = '내 정보')은 뺐다: 안내문이 더 이상 메뉴 이름을
 *   말하지 않아 이 안내와 맞춰 볼 이름이 없고(쉬운 글 A-06 대상 소멸), '역할 바꾸는 곳'이라는 전제도 틀렸다.
 *   그 링크의 존재·도달성은 MoreMenuClient.test.tsx(nav-reachability)가 계속 지킨다.
 */
describe('P6-C 쉬운 글 — 역할 바꾸는 방법 안내가 실제 절차(관리자에게 요청)를 말한다 (onboarding-role-change-hint)', () => {
  const HINT = '잘못 골랐어도 괜찮아요. 관리자에게 바꿔 달라고 말해 주세요.'

  it(`안내문이 결정 문구 "${HINT}" 그대로다`, () => {
    renderClient()
    expect(screen.getByText(HINT)).toBeInTheDocument()
  })

  it("스스로 바꿀 수 있다는 거짓 안내('내 정보'·'더보기'에서 바꾸기)·없는 메뉴 '계정 관리'·화살표(→)가 없다", () => {
    const { container } = renderClient()
    expect(container).not.toHaveTextContent(/내 정보.*바꿀 수 있어요/)
    expect(container).not.toHaveTextContent(/더보기.*바꿀 수 있어요/)
    expect(container).not.toHaveTextContent('계정 관리')
    expect(container).not.toHaveTextContent('→')
  })
})
