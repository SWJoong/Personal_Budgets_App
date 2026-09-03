import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P2 디자인 토큰 토대 — 아키텍처 적합성 계약 (W).
 * 설계: Plan&Source/goala_p2_token_foundation_W.md §7.
 *
 * 규칙: "토큰화 완료"로 지정된 화면 파일에는 raw Tailwind 팔레트 클래스
 *   (예: text-zinc-500 · bg-white · bg-emerald-50 · ring-amber-200)가 없어야 한다.
 *   화면이 시맨틱 토큰(bg-card·text-foreground·bg-success-bg …)만 써야, 테마가
 *   !important 화면오버라이드 없이 토큰 값 교체(html.dark-mode { --color-* })만으로 동작하기 때문.
 *
 * test-first: 현재 앵커(당사자 홈)에 raw 클래스가 있어 이 계약은 RED 다.
 *   U 가 매핑표(설계 §4)대로 토큰 치환 + globals.css 신규 토큰(§3-2) 추가 → green.
 *   Phase 진행에 따라 TOKENIZED_FILES 를 확장한다(P3~).
 */

const ROOT = process.cwd()

// 토큰화 규율이 적용되는(이관 완료 대상) 화면 파일. P2 = 앵커 1개. 이후 Phase 에서 확장.
const TOKENIZED_FILES = [
  'src/app/(participant)/page.tsx',
]

// Tailwind 임의 팔레트(시맨틱 토큰으로 대체돼야 함).
const SCALE = '(?:50|100|200|300|400|500|600|700|800|900|950)'
const PALETTES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PREFIX = 'bg|text|border|ring|from|via|to|divide|outline|fill|stroke|decoration|accent|caret|shadow'
// 예: text-zinc-500 · bg-emerald-50 · ring-amber-200 · border-zinc-100
const RAW_SCALE = new RegExp(`\\b(?:${PREFIX})-(?:${PALETTES})-${SCALE}\\b`, 'g')
// 예: bg-white · text-white · border-white · ring-white (→ bg-card·text-*-foreground 로)
const RAW_WHITE = /\b(?:bg|text|border|ring)-white\b/g

// 블록/JSX 주석 제거 — 주석이 클래스명을 언급해 생기는 오탐 방지.
// (라인 // 주석은 대상 파일 기준 팔레트 미언급이라 보존; 필요 시 후속 확장.)
function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
}

function findForbidden(src: string): string[] {
  const clean = stripBlockComments(src)
  const hits = [...(clean.match(RAW_SCALE) ?? []), ...(clean.match(RAW_WHITE) ?? [])]
  return [...new Set(hits)].sort()
}

describe('P2 토큰 토대 — 토큰화 화면의 raw 팔레트 클래스 금지', () => {
  it('스캐너가 대상 파일을 실제로 읽는다(적합성 테스트가 살아있음)', () => {
    for (const rel of TOKENIZED_FILES) {
      expect(existsSync(join(ROOT, rel)), `${rel} 가 존재해야 함(경로 오타 방지)`).toBe(true)
    }
    expect(TOKENIZED_FILES.length).toBeGreaterThan(0)
  })

  for (const rel of TOKENIZED_FILES) {
    it(`${rel}: raw 팔레트 클래스 0 (시맨틱 토큰만 사용)`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      const forbidden = findForbidden(src)
      expect(
        forbidden,
        `raw 팔레트 클래스 발견 → 시맨틱 토큰으로 치환하라(설계 §4): ${forbidden.join(', ')}`,
      ).toEqual([])
    })
  }
})
