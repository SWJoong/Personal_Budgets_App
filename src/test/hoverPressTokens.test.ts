import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P7 웨이브4 — hover / press / disabled 토큰 계약 (W 저작·독립 검증).
 * 설계·AA표: Plan&Source/goala_p7_hover_W.md.
 *
 * 배경(감사 evidence C2/C3/C4/C5/D3):
 *   - 전용 hover 토큰이 primary/sidebar 에만 있고 hero/danger/positive/warning/muted 는
 *     hover:opacity-90(42곳)으로 대체 → transition-colors 는 opacity 를 전이 못해 즉발·반투명이라
 *     hover 대비가 오히려 저하된다(C2/C3).
 *   - muted hover 관용구가 hover:bg-muted vs hover:opacity-90 로 이원화(C5).
 *   - press(active:scale) 가 손수 CTA 에만 있고 Button/LinkButton 프리미티브엔 없음(C4).
 *   - disabled:opacity-50 은 fg·bg 를 동시에 배경 쪽으로 흐려 AA 를 보장 못함(D3).
 *
 * 해법(설계 확정·4모드 AA≥4.5:1 독립 검증):
 *   globals.css 에 --color-{hero,danger,positive,warning,muted}-hover 5종 + disabled 토큰 2종 신설,
 *   솔리드/미디드 버튼 hover:opacity-90 → hover:bg-*-hover 로 통일, muted hover 단일 관용구,
 *   press 표준 active:scale-[0.98] 을 BUTTON_BASE_CLASS 에 내장(+ transform 전이 + reduce-motion),
 *   disabled 는 전용 4모드 토큰.
 *
 * test-first: 현재 main 상태(토큰 부재·opacity 관용구·프리미티브 press 없음)라 이 계약은 전부 RED.
 *   U 가 globals.css 토큰 추가 + buttonStyles/Button 프리미티브 + 매핑표(설계 §7)대로 치환 → green.
 *   src 구현은 U 레인 — 이 파일(테스트)·설계문만 W 저작.
 */

const ROOT = process.cwd()
const GLOBALS = 'src/app/globals.css'
const BUTTON_STYLES = 'src/components/ui/buttonStyles.ts'
const BUTTON = 'src/components/ui/Button.tsx'

// ─────────────────────────────────────────────────────────────────────────────
// CSS 토큰 해석기 — @theme(라이트 기본) + html.high-contrast/dark-mode/yellow-bg 오버라이드.
// 각 모드 값 = 해당 모드 블록의 재정의 ?? @theme 기본값(상속).
// ─────────────────────────────────────────────────────────────────────────────
type Mode = 'light' | 'highContrast' | 'dark' | 'yellow'
const MODE_SELECTOR: Record<Exclude<Mode, 'light'>, string> = {
  highContrast: 'html.high-contrast',
  dark: 'html.dark-mode',
  yellow: 'html.yellow-bg',
}

/** 최상위(depth 0) CSS 블록을 {selector, body} 로 분해. 토큰 블록은 전부 최상위라 이 파서로 충분. */
function topLevelBlocks(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = []
  let depth = 0
  let selStart = 0
  let bodyStart = -1
  let sel = ''
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (ch === '{') {
      if (depth === 0) {
        // ★셀렉터에서 preamble(주석·@import/@charset/@plugin …; 문) 제거 — globals.css 는 @theme 앞에
        // top-level `}` 없이 @import + 주석이 와서 @theme 셀렉터가 preamble 로 오염되던 버그 수정.
        sel = css
          .slice(selStart, i)
          .replace(/\/\*[\s\S]*?\*\//g, ' ') // 블록 주석 제거
          .replace(/@[a-z-]+[^;{}]*;/gi, ' ') // at-statement(@import/@charset/@plugin …;) 제거(블록 @-rule 은 ; 없어 보존)
          .trim()
          .replace(/\s+/g, ' ')
        bodyStart = i + 1
      }
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        out.push({ selector: sel, body: css.slice(bodyStart, i) })
        selStart = i + 1
      }
    }
  }
  return out
}

/** 특정 셀렉터(정확 일치)의 모든 블록에서 --var 선언을 병합 수집. */
function collectVars(blocks: { selector: string; body: string }[], selector: string): Map<string, string> {
  const vars = new Map<string, string>()
  for (const b of blocks) {
    if (b.selector !== selector) continue
    const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(b.body))) vars.set(m[1].trim(), m[2].trim())
  }
  return vars
}

function resolveToken(
  blocks: { selector: string; body: string }[],
  name: string,
  mode: Mode,
): string | null {
  const theme = collectVars(blocks, '@theme')
  const base = theme.get(name) ?? null
  if (mode === 'light') return base
  const override = collectVars(blocks, MODE_SELECTOR[mode]).get(name)
  return override ?? base
}

// ─────────────────────────────────────────────────────────────────────────────
// 색 파서 + WCAG 대비.
// ─────────────────────────────────────────────────────────────────────────────
function parseColor(v: string): [number, number, number] | null {
  const s = v.trim()
  let m = s.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  m = s.match(/^#([0-9a-f]{3})$/i)
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16))
    return [r, g, b]
  }
  m = s.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/i)
  if (m) return hslToRgb(+m[1], +m[2], +m[3])
  return null
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}
function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// ─────────────────────────────────────────────────────────────────────────────
// src 파일 워커(테스트/스펙 제외) — fs-scan 계약용.
// ─────────────────────────────────────────────────────────────────────────────
function walkSrc(): string[] {
  const files: string[] = []
  const stack = [join(ROOT, 'src')]
  while (stack.length) {
    const dir = stack.pop()!
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (name === 'test') continue
        stack.push(full)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) {
        files.push(full)
      }
    }
  }
  return files
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const MODES: Mode[] = ['light', 'highContrast', 'dark', 'yellow']
const AA = 4.5

// ═══════════════════════════════════════════════════════════════════════════
// Part A — globals.css 가 hover / disabled 토큰을 4모드 규율대로 선언한다.
// ═══════════════════════════════════════════════════════════════════════════
describe('P7-w4 A: globals.css hover/disabled 토큰 선언', () => {
  const css = existsSync(join(ROOT, GLOBALS)) ? readFileSync(join(ROOT, GLOBALS), 'utf8') : ''
  const blocks = topLevelBlocks(css)

  // 5종 hover 토큰이 @theme(라이트 기본)에 존재.
  const HOVER_TOKENS = [
    '--color-hero-hover',
    '--color-danger-hover',
    '--color-positive-hover',
    '--color-warning-hover',
    '--color-muted-hover',
  ]
  for (const t of HOVER_TOKENS) {
    it(`${t} 가 @theme 에 선언됨`, () => {
      expect(resolveToken(blocks, t, 'light'), `${t} 가 globals.css @theme 에 없음`).not.toBeNull()
    })
  }

  // hero-hover·muted-hover 는 4모드 재정의 필수(모드별 표면색이 달라 단일값 불가).
  for (const t of ['--color-hero-hover', '--color-muted-hover']) {
    it(`${t} 는 HC·dark 에서 재정의됨(4모드)`, () => {
      const hc = collectVars(blocks, 'html.high-contrast').get(t)
      const dark = collectVars(blocks, 'html.dark-mode').get(t)
      expect(hc, `${t} 가 html.high-contrast 에서 재정의돼야 함`).toBeTruthy()
      expect(dark, `${t} 가 html.dark-mode 에서 재정의돼야 함`).toBeTruthy()
    })
  }

  // danger/positive/warning-hover 는 4모드 상수(:root 단일값) — 재정의 없이 전모드 동일.
  it('danger/positive/warning-hover 는 @theme 단일 상수(HC/dark 재정의 없음)', () => {
    for (const t of ['--color-danger-hover', '--color-positive-hover', '--color-warning-hover']) {
      expect(resolveToken(blocks, t, 'light'), `${t} @theme 값 필요`).not.toBeNull()
    }
  })

  // disabled 전용 토큰(bg/fg) — opacity 로는 AA 보장 불가라 전용 토큰.
  for (const t of ['--color-disabled-bg', '--color-disabled-fg']) {
    it(`${t} 가 @theme 에 선언됨`, () => {
      expect(resolveToken(blocks, t, 'light'), `${t} 가 globals.css 에 없음`).not.toBeNull()
    })
    it(`${t} 는 HC·dark 에서 재정의됨(4모드)`, () => {
      expect(collectVars(blocks, 'html.high-contrast').get(t), `${t} HC 재정의 필요`).toBeTruthy()
      expect(collectVars(blocks, 'html.dark-mode').get(t), `${t} dark 재정의 필요`).toBeTruthy()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// Part B — 토큰 AA 계산 게이트. 각 hover bg 를 '지정 foreground' 위에서, disabled bg/fg 쌍을
//   4모드로 실측 대비 계산 → ≥4.5:1. U 가 넣은 실제 값이 AA 를 못 넘기면 RED 유지.
// ═══════════════════════════════════════════════════════════════════════════
describe('P7-w4 B: 토큰 AA(4모드 ≥4.5:1)', () => {
  const css = existsSync(join(ROOT, GLOBALS)) ? readFileSync(join(ROOT, GLOBALS), 'utf8') : ''
  const blocks = topLevelBlocks(css)

  // [hover 토큰, 그 위에 얹히는 foreground 토큰] — 지정 fg 는 설계 §5(적용 대상)에 고정.
  //   warning-hover 의 fg 는 반드시 warning-foreground(어두운 앰버) — 흰 글자는 3.24:1 로 AA FAIL.
  //   muted-hover 의 fg 는 text-foreground(실제 버튼 소비자) — muted-foreground 는 다크에서 4.16:1 FAIL.
  const HOVER_PAIRS: [string, string][] = [
    ['--color-hero-hover', '--color-hero-foreground'],
    ['--color-danger-hover', '--color-danger-foreground'],
    ['--color-positive-hover', '--color-positive-foreground'],
    ['--color-warning-hover', '--color-warning-foreground'],
    ['--color-muted-hover', '--color-foreground'],
  ]

  for (const [bgTok, fgTok] of HOVER_PAIRS) {
    for (const mode of MODES) {
      it(`${bgTok} 위 ${fgTok} — ${mode} ≥${AA}:1`, () => {
        const bgv = resolveToken(blocks, bgTok, mode)
        const fgv = resolveToken(blocks, fgTok, mode)
        expect(bgv, `${bgTok}(${mode}) 미선언`).not.toBeNull()
        expect(fgv, `${fgTok}(${mode}) 미선언`).not.toBeNull()
        const bg = parseColor(bgv!)
        const fg = parseColor(fgv!)
        expect(bg, `${bgTok}(${mode}) 색 파싱 실패: ${bgv}`).not.toBeNull()
        expect(fg, `${fgTok}(${mode}) 색 파싱 실패: ${fgv}`).not.toBeNull()
        const r = contrast(bg!, fg!)
        expect(r, `${bgTok} 위 ${fgTok} ${mode} = ${r.toFixed(2)}:1 (<${AA})`).toBeGreaterThanOrEqual(AA)
      })
    }
  }

  for (const mode of MODES) {
    it(`disabled-fg 위 disabled-bg — ${mode} ≥${AA}:1`, () => {
      const bgv = resolveToken(blocks, '--color-disabled-bg', mode)
      const fgv = resolveToken(blocks, '--color-disabled-fg', mode)
      expect(bgv, `disabled-bg(${mode}) 미선언`).not.toBeNull()
      expect(fgv, `disabled-fg(${mode}) 미선언`).not.toBeNull()
      const bg = parseColor(bgv!)
      const fg = parseColor(fgv!)
      expect(bg, `disabled-bg(${mode}) 파싱 실패: ${bgv}`).not.toBeNull()
      expect(fg, `disabled-fg(${mode}) 파싱 실패: ${fgv}`).not.toBeNull()
      const r = contrast(bg!, fg!)
      expect(r, `disabled ${mode} = ${r.toFixed(2)}:1 (<${AA})`).toBeGreaterThanOrEqual(AA)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// Part C — buttonStyles / Button 프리미티브: 최대 blast-radius 진실원천.
// ═══════════════════════════════════════════════════════════════════════════
describe('P7-w4 C: 프리미티브(buttonStyles/Button)', () => {
  const bs = existsSync(join(ROOT, BUTTON_STYLES)) ? readFileSync(join(ROOT, BUTTON_STYLES), 'utf8') : ''
  const btn = existsSync(join(ROOT, BUTTON)) ? readFileSync(join(ROOT, BUTTON), 'utf8') : ''

  it('danger/positive/warning variant 는 hover:bg-*-hover 사용(opacity 금지)', () => {
    expect(bs).toMatch(/danger:[^\n]*hover:bg-danger-hover/)
    expect(bs).toMatch(/positive:[^\n]*hover:bg-positive-hover/)
    expect(bs).toMatch(/warning:[^\n]*hover:bg-warning-hover/)
    expect(bs, 'buttonStyles 에 hover:opacity-90 이 남아있음').not.toMatch(/hover:opacity-90/)
  })

  it('warning variant 의 foreground 는 text-warning-foreground(흰 글자 2.75:1 FAIL 교정)', () => {
    const warning = bs.split('\n').find((l) => /^\s*warning:/.test(l)) ?? ''
    expect(warning, `warning 라인: ${warning}`).toMatch(/text-warning-foreground/)
    expect(warning, 'warning 이 text-primary-foreground(흰) 유지').not.toMatch(/text-primary-foreground/)
  })

  it('C5: secondary/ghost 의 muted hover 는 단일 관용구 hover:bg-muted-hover', () => {
    const secondary = bs.split('\n').find((l) => /^\s*secondary:/.test(l)) ?? ''
    const ghost = bs.split('\n').find((l) => /^\s*ghost:/.test(l)) ?? ''
    expect(secondary).toMatch(/hover:bg-muted-hover/)
    expect(ghost).toMatch(/hover:bg-muted-hover/)
    expect(secondary, 'secondary 가 옛 hover:bg-muted 관용구 잔존').not.toMatch(/hover:bg-muted(?!-hover)/)
    expect(ghost, 'ghost 가 옛 hover:bg-muted 관용구 잔존').not.toMatch(/hover:bg-muted(?!-hover)/)
  })

  it('C4: press 표준 active:scale-[0.98] 이 BUTTON_BASE_CLASS 에 내장', () => {
    const base = bs.match(/BUTTON_BASE_CLASS\s*=\s*[\s\S]*?['"`]([^'"`]*)['"`]/)
    const baseStr = base?.[1] ?? ''
    expect(baseStr, `BUTTON_BASE_CLASS: ${baseStr}`).toMatch(/active:scale-\[0\.98\]/)
  })

  it('C4: BUTTON_BASE_CLASS 의 transition 이 transform 을 전이(단독 transition-colors 금지)', () => {
    const base = bs.match(/BUTTON_BASE_CLASS\s*=\s*[\s\S]*?['"`]([^'"`]*)['"`]/)
    const baseStr = base?.[1] ?? ''
    const coversTransform = /transition-all/.test(baseStr) || (/transition-\[/.test(baseStr) && /transform/.test(baseStr))
    expect(coversTransform, `press 가 애니메이트되려면 transform 전이 필요: ${baseStr}`).toBe(true)
    const bareColors = /\btransition-colors\b/.test(baseStr) && !coversTransform
    expect(bareColors, 'transition-colors 단독은 scale 을 전이 못함').toBe(false)
  })

  it('C4: BUTTON_BASE_CLASS 에 reduce-motion 가드(scale 무효화)', () => {
    const base = bs.match(/BUTTON_BASE_CLASS\s*=\s*[\s\S]*?['"`]([^'"`]*)['"`]/)
    const baseStr = base?.[1] ?? ''
    expect(baseStr, `reduce-motion 가드 필요: ${baseStr}`).toMatch(/motion-reduce:active:scale-100/)
  })

  it('D3: Button 프리미티브 disabled 는 전용 토큰(opacity 금지)', () => {
    expect(btn, 'Button 이 disabled:opacity-50 사용').not.toMatch(/disabled:opacity-50/)
    expect(btn).toMatch(/disabled:bg-disabled-bg/)
    expect(btn).toMatch(/disabled:text-disabled-fg/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Part D — 앱 전역 fs-scan(솔리드/미디드 버튼 관용구 통일).
// ═══════════════════════════════════════════════════════════════════════════
describe('P7-w4 D: 전역 fs-scan', () => {
  const files = walkSrc()

  it('솔리드/미디드 버튼 hover:opacity-90 근절(→ hover:bg-*-hover)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf8'))
      if (/hover:opacity-90/.test(src)) offenders.push(f.replace(ROOT + '/', ''))
    }
    expect(offenders, `hover:opacity-90 잔존 파일(→ hover:bg-{hero,danger,positive,warning,muted}-hover): ${offenders.join(', ')}`).toEqual([])
  })

  it('C5: muted hover 단일 관용구 — hover:bg-muted(비-hover) 잔존 금지', () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf8'))
      if (/hover:bg-muted(?!-hover)/.test(src)) offenders.push(f.replace(ROOT + '/', ''))
    }
    expect(offenders, `옛 hover:bg-muted 관용구 → hover:bg-muted-hover 로 통일(다크 chip/tab 은 text-foreground 병행): ${offenders.join(', ')}`).toEqual([])
  })

  it('C4: active:scale 값은 화이트리스트 {[0.98], 95, 90} 만 허용', () => {
    const allowed = new Set(['[0.98]', '95', '90'])
    const offenders: string[] = []
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf8'))
      // motion-reduce:active:scale-100 은 reduce 리셋 가드(C4-reduce 필수)라 press 값 난립이 아님 → 제외.
      const re = /(?<!motion-reduce:)active:scale-(\[[^\]]+\]|\d+)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        if (!allowed.has(m[1])) offenders.push(`${f.replace(ROOT + '/', '')}: active:scale-${m[1]}`)
      }
    }
    expect(offenders, `press 스케일 난립(표준 밖): ${offenders.join(', ')}`).toEqual([])
  })

  it('C4: active:scale 은 transform 전이와 함께여야(단독 transition-colors 페어링 금지)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const lines = stripComments(readFileSync(f, 'utf8')).split('\n')
      lines.forEach((line, i) => {
        if (!/active:scale/.test(line)) return
        const covers = /transition-all/.test(line) || (/transition-\[/.test(line) && /transform/.test(line))
        if (/\btransition-colors\b/.test(line) && !covers) {
          offenders.push(`${f.replace(ROOT + '/', '')}:${i + 1}`)
        }
      })
    }
    expect(offenders, `transition-colors + active:scale = scale 즉발(전이 불가) — transition-all/transform 로 교정: ${offenders.join(', ')}`).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Part E — disabled 토큰 채택(프리미티브 + 명시된 muted 앵커 2곳).
//   solid/muted 저항(resting) disabled 상태는 opacity 로 표시하면 AA 붕괴(설계 §6).
// ═══════════════════════════════════════════════════════════════════════════
describe('P7-w4 E: disabled 토큰 채택', () => {
  const MUTED_ANCHORS = [
    'src/app/(supporter)/supporter/review/ReviewQueueClient.tsx',
    'src/app/(supporter)/supporter/applications/[id]/ApplicationDetailClient.tsx',
  ]

  for (const rel of MUTED_ANCHORS) {
    it(`${rel}: muted 버튼 disabled 는 opacity 대신 전용 토큰`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      const offenders = src
        .split('\n')
        .map((l, i) => ({ l, i: i + 1 }))
        .filter(({ l }) => /bg-muted/.test(l) && /disabled:opacity-/.test(l))
        .map(({ i }) => `${rel}:${i}`)
      expect(offenders, `muted disabled 버튼이 opacity 사용(→ disabled:bg-disabled-bg disabled:text-disabled-fg): ${offenders.join(', ')}`).toEqual([])
    })
  }
})
