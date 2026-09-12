import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * 접근성 적합성(fitness) — 화살표 글리프 컨트롤은 접근명을 가져야 한다 (W 레인). 목표: 3역할 WAI-ARIA.
 * 설계: Plan&Source/goala_a11y_remediation_W.md §1.
 *
 * 규칙: `←`/`→` 를 **요소 텍스트로만** 쓰는 뒤로가기·이동 컨트롤은 스크린리더가 "왼쪽 화살표"로 읽으면
 *   안 된다. 반드시 (a) 감싸는 인터랙티브 요소(a/Link/button)에 aria-label 이 있거나, (b) 글리프가
 *   aria-hidden 이어야 한다(그러면 접근명은 형제 텍스트/aria-label 이 담당). PageHeader 프리미티브가 정답 패턴.
 *
 * 제외: 라벨 텍스트를 동반한 화살표("← 이전", "다음 →")·JSX 표현식 분리자({' → '})는 콘텐츠라 대상 아님.
 * 스캔: src/app · src/components (테스트 파일 제외). 위반 시 목록과 함께 실패.
 *
 * 배경: 코드베이스 대부분(34/39)은 이미 준수(aria-label 또는 aria-hidden). 이 가드는 남은 소수를
 *   초록화한 뒤 **회귀를 고정**한다(신규 화면이 맨 화살표 컨트롤을 추가하면 실패).
 */

function scanFiles(): string[] {
  const out = execSync('grep -rl "[←→]" src/app src/components --include="*.tsx" || true', { encoding: 'utf8' })
  return out.trim().split('\n').filter((f) => f && !/\.(test|spec|p6c|p7c)\./.test(f))
}

/** 파일에서 접근명 없는 화살표-전용 컨트롤 위반 위치(파일:줄)를 찾는다. audit 로직과 동일. */
function findArrowOffenders(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const offenders: string[] = []
  const re = />[^<>]*[←→][^<>]*</g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const idx = m.index
    const textOnly = m[0].slice(1, -1)
    // 라벨 텍스트 동반(화살표 외 한글/영문 존재) → 콘텐츠, 대상 아님.
    if (/[가-힣A-Za-z]/.test(textOnly.replace(/[←→]/g, ''))) continue
    // JSX 표현식 분리자({' → '} 등) → 콘텐츠, 대상 아님.
    if (/\{['"`]/.test(textOnly)) continue
    // 글리프를 감싼 요소가 aria-hidden 인가.
    const pre = src.slice(Math.max(0, idx - 200), idx + 1)
    const glyphTag = pre.slice(pre.lastIndexOf('<'))
    const glyphHidden = /aria-hidden/.test(glyphTag)
    // 감싸는 인터랙티브 요소(a/Link/button)의 여는 태그에 aria-label 이 있는가.
    const ctx = src.slice(Math.max(0, idx - 500), idx)
    const openInteractive = Math.max(ctx.lastIndexOf('<Link'), ctx.lastIndexOf('<a '), ctx.lastIndexOf('<button'))
    const interactiveOpenTag = openInteractive >= 0 ? (ctx.slice(openInteractive).split('>')[0] ?? '') : ''
    const hasAriaLabel = /aria-label/.test(interactiveOpenTag)
    if (!glyphHidden && !hasAriaLabel) {
      offenders.push(`${file}:${src.slice(0, idx).split('\n').length}`)
    }
  }
  return offenders
}

describe('a11y fitness — 화살표 컨트롤 접근명', () => {
  const files = scanFiles()

  it('스캐너가 파일을 실제로 읽는다(적합성 테스트 살아있음)', () => {
    expect(files.length).toBeGreaterThan(3)
  })

  it('접근명 없는 화살표-전용 컨트롤이 없다(뒤로가기·이동 = aria-label 또는 aria-hidden 글리프)', () => {
    const offenders = files.flatMap(findArrowOffenders)
    expect(offenders, `접근명 없는 화살표 컨트롤(스크린리더가 "화살표"로 읽음):\n${offenders.join('\n')}`).toEqual([])
  })
})
