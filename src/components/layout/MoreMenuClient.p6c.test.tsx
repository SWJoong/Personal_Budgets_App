import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import MoreMenuClient from './MoreMenuClient'

/**
 * P6 Phase C — 더보기 화면설정 스위치 44px + 장식 이모지 (f13f641 B4·A6-content 재적용)
 * 출처: feat/kwcag-a11y-foundation f13f641 — 고대비 스위치만 44px 래퍼로 main 에 들어왔고,
 *   다크·쉬운 말·노란 배경 스위치는 버튼 자체가 'w-14 h-8'(세로 32px) 로 남아 있었다.
 *
 * - 스위치 4종: 보이는 트랙(w-14 h-8 = 56×32px)은 버튼 자신이고, 세로 터치 영역만 ::before(h-11 = 44px,
 *   가운데 정렬)로 넓힌다 → 줄 높이·모양 불변. 트랙을 안쪽 span 으로 옮기면 안 된다: globals.css 의
 *   다크·고대비 규칙 `.participant-view [class*="rounded-"]:not(button)` 가 !important 배경을 씌워
 *   켜짐 색이 카드색(다크 #1a2540)·흰색(고대비)으로 덮인다(jsdom 은 CSS 미적용 → 구조로 고정 +
 *   globals.css 의 `:not(button)` 예외가 남아 있는지 원문 스캔).
 * - 켜짐/꺼짐 상태 클래스는 트랙(=role="switch" 버튼)에 있다: 켜짐 bg-primary · 꺼짐 bg-muted-foreground
 *   (bg-muted 는 카드 위 ≈1.1:1 이라 꺼진 스위치가 안 보였다). 색 말고도 손잡이 위치(left-1/left-7)와
 *   켜짐 때만 손잡이 안 체크 표시(aria-hidden)로 상태를 보인다.
 * - 라벨 앞 이모지(🌗🌙💬🟡🔤)·빠른 이동 카드 이모지·빈 서류함 📁 는 장식 → aria-hidden.
 *   → 화면에 렌더된 모든 이모지 글자가 aria-hidden 아래(또는 aria-label 로 이름이 덮인 컨트롤 안)에 있다.
 * - 섹션 펼침 버튼의 ▲/▼ 는 aria-expanded 가 상태를 전달하므로 장식 → 접근명은 '<제목> 접기/펼치기'.
 *
 * 훅/모듈 의존: MoreMenuClient.test.tsx 와 같은 모킹(렌더 성공이 전제). useAccessibility 상태만 테스트별로 바꾼다.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))

// 스위치 켜짐/꺼짐을 테스트마다 바꿀 수 있게 상태를 hoisted 객체로 둔다(기본 전부 꺼짐).
const a11y = vi.hoisted(() => ({ highContrast: false, easyTerms: false, yellowBg: false, darkMode: false }))
vi.mock('@/hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    fontSize: 'normal', setFontSize: vi.fn(),
    highContrast: a11y.highContrast, setHighContrast: vi.fn(),
    easyTerms: a11y.easyTerms, setEasyTerms: vi.fn(),
    yellowBg: a11y.yellowBg, setYellowBg: vi.fn(),
    darkMode: a11y.darkMode, setDarkMode: vi.fn(),
  }),
}))

beforeEach(() => {
  a11y.highContrast = false
  a11y.easyTerms = false
  a11y.yellowBg = false
  a11y.darkMode = false
})

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
  const SWITCHES = ['글씨 더 잘 보이기 전환', '다크 모드 전환', '쉬운 용어 모드 전환', '노란 배경 모드 전환']
  const cls = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/)

  it.each(SWITCHES)("'%s' 스위치가 가로·세로 44px 터치 영역을 가진다(트랙 56px + ::before 세로 44px)", (name) => {
    render(<MoreMenuClient fileLinks={[]} initialOpenSection="display" />)
    const c = cls(screen.getByRole('switch', { name }))
    // 가로: 보이는 트랙 w-14(56px) 가 버튼 자신 → 44px 이상
    expect(c).toContain('w-14')
    // 세로: 트랙 h-8(32px) 은 그대로, 버튼 기준(relative) ::before 가 h-11(44px) 로 가운데에 겹친다
    expect(c).toContain('relative')
    expect(c).toEqual(expect.arrayContaining([
      'before:absolute', 'before:inset-x-0', 'before:top-1/2', 'before:-translate-y-1/2', 'before:h-11',
    ]))
  })
})

describe('P6-C 스위치 상태 표시 — 모든 화면 모드에서 켜짐/꺼짐이 보인다 (moremenu-switch-state)', () => {
  const SWITCHES = [
    { name: '글씨 더 잘 보이기 전환', key: 'highContrast' },
    { name: '다크 모드 전환', key: 'darkMode' },
    { name: '쉬운 용어 모드 전환', key: 'easyTerms' },
    { name: '노란 배경 모드 전환', key: 'yellowBg' },
  ] as const
  const TRACK_COLORS = ['bg-primary', 'bg-muted-foreground', 'bg-muted']
  const cls = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/)
  const cases = SWITCHES.flatMap((s) => [
    { ...s, on: true },
    { ...s, on: false },
  ])

  it.each(cases)("$name (켜짐=$on): 상태 색 클래스는 트랙인 버튼 자신에 있고, 손잡이 위치·체크 표시가 상태를 따른다", ({ name, key, on }) => {
    a11y[key] = on
    render(<MoreMenuClient fileLinks={[]} initialOpenSection="display" />)
    const sw = screen.getByRole('switch', { name })
    expect(sw.tagName).toBe('BUTTON') // `:not(button)` 테마 예외를 받는 요소
    expect(sw).toHaveAttribute('aria-checked', String(on))

    const c = cls(sw)
    expect(c).toContain('rounded-full')
    // 켜짐 = bg-primary, 꺼짐 = bg-muted-foreground(카드 위 3:1 이상). bg-muted(≈1.1:1) 로 돌아가면 실패.
    expect(c.filter((k) => TRACK_COLORS.includes(k))).toEqual([on ? 'bg-primary' : 'bg-muted-foreground'])

    // 트랙 색을 가진 rounded- 자손이 있으면 다크·고대비 CSS 가 그 색을 덮는다 → 자손엔 트랙 색이 없어야 한다
    const coloredDesc = Array.from(sw.querySelectorAll('[class*="rounded-"]')).filter((el) =>
      cls(el).some((k) => TRACK_COLORS.includes(k)),
    )
    expect(coloredDesc).toEqual([])

    // 색이 아닌 신호: 손잡이 위치 + 켜짐일 때만 체크 표시(장식 → aria-hidden, 이름엔 안 섞임)
    const thumb = sw.querySelector(':scope > span')!
    expect(cls(thumb)).toContain(on ? 'left-7' : 'left-1')
    expect(cls(thumb)).not.toContain(on ? 'left-1' : 'left-7')
    const check = thumb.querySelector('svg')
    if (on) {
      expect(check).not.toBeNull()
      expect(check).toHaveAttribute('aria-hidden', 'true')
    } else {
      expect(check).toBeNull()
    }
    expect(sw).toHaveAccessibleName(name)
  })

  it('globals.css 의 다크·고대비 둥근요소 배경 강제 규칙은 button 을 예외로 둔다(트랙=버튼 전제)', () => {
    const css = readFileSync('src/app/globals.css', 'utf8')
    for (const mode of ['high-contrast', 'dark-mode']) {
      const re = new RegExp(`html\\.${mode} \\.participant-view \\[class\\*="rounded-"\\]([^{,]*)`)
      const m = css.match(re)
      expect(m, mode).not.toBeNull()
      expect(m![1], mode).toContain(':not(button)')
    }
  })
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
