import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * 접근성 적합성(fitness) — 새 창 링크는 예고와 rel 보안을 갖춰야 한다 (W 레인). 목표: 3역할 WAI-ARIA + 인지.
 * 설계: Plan&Source/goala_a11y_remediation_W.md §1.
 *
 * 규칙: `target="_blank"` 로 **새 창/탭**을 여는 링크는
 *   (1) 사용자에게 새 창 열림을 **예고**해야 한다(인지 접근성·맥락 변화 예고 — 발달장애 당사자에 특히 중요):
 *       링크 텍스트나 aria-label 에 "새 창"/"새 탭" 문구.
 *   (2) 보안·성능상 `rel` 에 `noopener` 포함(가능하면 noreferrer).
 * 스캔: src (테스트 제외). 위반 시 목록과 함께 실패.
 */

function scanFiles(): string[] {
  const out = execSync('grep -rl "_blank" src --include="*.tsx" || true', { encoding: 'utf8' })
  return out.trim().split('\n').filter((f) => f && !/\.(test|spec|p6c|p7c)\./.test(f))
}

interface Violation { where: string; reason: string }

function findBlankViolations(file: string): Violation[] {
  const src = readFileSync(file, 'utf8')
  const violations: Violation[] = []
  const re = /target\s*=\s*["']_blank["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const idx = m.index
    const line = src.slice(0, idx).split('\n').length
    // 여는 태그(< 부터)부터 요소의 닫는 태그(</a> 또는 </Link>)까지 요소 전체를 스캔한다
    // — 큰 SVG 등으로 텍스트가 멀리 있어도 예고 문구를 놓치지 않도록(고정 윈도우 금지).
    const openStart = src.lastIndexOf('<', idx)
    const closes = [src.indexOf('</a>', idx), src.indexOf('</Link>', idx)].filter((i) => i >= 0)
    const end = closes.length ? Math.min(...closes) : idx + 600
    const element = src.slice(openStart, end)
    const hasNoopener = /rel\s*=\s*["'][^"']*noopener/.test(element)
    const hasCue = /새\s*창|새\s*탭|new window/i.test(element)
    if (!hasCue) violations.push({ where: `${file}:${line}`, reason: '새 창 예고 문구 없음(텍스트/aria-label)' })
    if (!hasNoopener) violations.push({ where: `${file}:${line}`, reason: 'rel="noopener" 없음' })
  }
  return violations
}

describe('a11y fitness — 새 창(target=_blank) 링크 예고·보안', () => {
  const files = scanFiles()

  it('새 창 링크는 예고 문구와 rel=noopener 를 갖춘다', () => {
    const v = files.flatMap(findBlankViolations)
    expect(v, `새 창 링크 위반:\n${v.map((x) => `${x.where} — ${x.reason}`).join('\n')}`).toEqual([])
  })
})
