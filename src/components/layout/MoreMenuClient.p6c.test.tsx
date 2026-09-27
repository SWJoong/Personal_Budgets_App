import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MoreMenuClient from './MoreMenuClient'

/**
 * P6 Phase C — 더보기 화면설정 스위치 44px + 장식 이모지 (f13f641 B4·A6-content 재적용)
 * 출처: feat/kwcag-a11y-foundation f13f641 — 고대비 스위치만 44px 래퍼로 main 에 들어왔고,
 *   다크·쉬운 말·노란 배경 스위치는 버튼 자체가 'w-14 h-8'(세로 32px) 로 남아 있었다.
 *
 * - 스위치 4종: 버튼 = 44px 터치 래퍼, 보이는 트랙(w-14 h-8)은 안쪽 span 이라 모양 불변.
 * - 라벨 앞 이모지(🌗🌙💬🟡🔤)·빠른 이동 카드 이모지·빈 서류함 📁 는 장식 → aria-hidden.
 *   → 화면에 렌더된 모든 이모지 글자가 aria-hidden 아래(또는 aria-label 로 이름이 덮인 컨트롤 안)에 있다.
 * - 섹션 펼침 버튼의 ▲/▼ 는 aria-expanded 가 상태를 전달하므로 장식 → 접근명은 '<제목> 접기/펼치기'.
 *
 * 훅/모듈 의존: MoreMenuClient.test.tsx 와 같은 모킹(렌더 성공이 전제). 색 토큰 단언 없음.
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

const TOUCH_H = /(?:^|\s)(?:min-h-11|min-h-\[44px\]|h-11)(?:\s|$)/
const TOUCH_W = /(?:^|\s)(?:min-w-11|min-w-\[44px\]|w-11)(?:\s|$)/
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

describe('P6-C touch44 — 더보기 화면설정 스위치 (moremenu-switch-touch)', () => {
  it.each(['글씨 더 잘 보이기 전환', '다크 모드 전환', '쉬운 용어 모드 전환', '노란 배경 모드 전환'])(
    "'%s' 스위치가 가로·세로 44px 터치 크기 클래스를 가진다",
    (name) => {
      render(<MoreMenuClient fileLinks={[]} initialOpenSection="display" />)
      const sw = screen.getByRole('switch', { name })
      expect(sw.className).toMatch(TOUCH_H)
      expect(sw.className).toMatch(TOUCH_W)
      // 보이는 트랙 크기는 안쪽 요소가 맡는다(버튼 자체가 'h-8' 32px 이면 안 됨)
      expect(sw.className).not.toMatch(/(?:^|\s)h-8(?:\s|$)/)
    },
  )
})

describe('P6-C 장식 이모지 — 더보기 (moremenu-emoji-hidden)', () => {
  it('모든 섹션을 펼쳐도 스크린리더에 노출되는 이모지가 없다', () => {
    const { container } = render(<MoreMenuClient fileLinks={[]} initialOpenSection="display" />)
    // 서류함(빈 상태 📁)도 펼쳐 한 번에 본다
    fireEvent.click(screen.getByRole('button', { name: '내 서류함 펼치기' }))
    expect(screen.getByText('아직 등록한 서류가 없어요.')).toBeInTheDocument()
    expect(exposedEmoji(container)).toEqual([])
  })

  it('화면설정 라벨 앞 이모지는 aria-hidden 이다', () => {
    render(<MoreMenuClient fileLinks={[]} initialOpenSection="display" />)
    for (const e of ['🔤', '🌗', '🌙', '💬', '🟡']) {
      expect(screen.getByText(e).closest('[aria-hidden="true"]'), e).not.toBeNull()
    }
  })

  it('섹션 펼침 버튼 접근명에 ▲/▼ 가 없다(상태는 aria-expanded)', () => {
    render(<MoreMenuClient fileLinks={[]} initialOpenSection="display" />)
    const display = screen.getByRole('button', { name: '화면 설정 접기' })
    expect(display).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '내 서류함 펼치기' })).toHaveAttribute('aria-expanded', 'false')
  })
})
