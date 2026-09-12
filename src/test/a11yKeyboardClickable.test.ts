import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * 접근성 적합성(fitness) — 클릭 가능한 요소는 키보드로도 조작 가능해야 한다 (W 레인).
 * 목표: 실무자·관리자 "키보드만으로 업무 처리 가능" + 3역할 WAI-ARIA. 설계: goala_a11y_remediation_W.md §슬라이스2.
 *
 * 규칙: 비인터랙티브 요소(div/span/li/section 등)에 onClick 을 달았다면, 키보드 사용자도 조작할 수 있게
 *   (a) role + tabIndex + onKeyDown/Up 을 함께 갖추거나, (b) aria-hidden 인 **장식용 배경**(백드롭)이어야
 *   한다(그 경우 실제 조작은 Esc·닫기 버튼 등 별도 키보드 경로가 담당 — Modal 프리미티브 패턴).
 *   네이티브 인터랙티브(button/a/Link/input/select/textarea/summary/label) 와 커스텀 컴포넌트(대문자)는 제외.
 *
 * 배경: 현재 코드베이스는 이 규칙을 이미 충족(클릭 div 3곳은 전부 aria-hidden 백드롭). 이 가드는 그 상태를
 *   고정해, 신규 화면이 키보드로 못 쓰는 clickable div 를 추가하면 CI 가 실패하게 한다.
 */

function scanFiles(): string[] {
  const out = execSync('grep -rl "onClick" src/app src/components --include="*.tsx" || true', { encoding: 'utf8' })
  return out.trim().split('\n').filter((f) => f && !/\.(test|spec|p6c|p7c)\./.test(f))
}

const NATIVE_INTERACTIVE = /^(button|a|input|select|textarea|Link|summary|label|option)$/

function findKeyboardOffenders(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const offenders: string[] = []
  const re = /onClick=/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const idx = m.index
    const open = src.lastIndexOf('<', idx)
    if (open < 0) continue
    const tagName = (src.slice(open, idx).match(/^<([A-Za-z][A-Za-z0-9.]*)/) ?? [])[1] ?? '?'
    if (NATIVE_INTERACTIVE.test(tagName)) continue // 네이티브 인터랙티브 = 키보드 기본 지원
    if (/^[A-Z]/.test(tagName)) continue // 커스텀 컴포넌트 = 내부에서 처리(별도 계약)
    // 여는 태그 전체(< ~ 첫 >) 를 본다.
    const openTag = src.slice(open, src.indexOf('>', idx) >= 0 ? src.indexOf('>', idx) + 1 : idx + 400)
    const ariaHidden = /aria-hidden\s*=\s*["'{]?\s*true/.test(openTag)
    if (ariaHidden) continue // 장식 배경(백드롭) — 조작은 Esc/닫기버튼이 담당
    const ok = /role=/.test(openTag) && /tabIndex/.test(openTag) && /onKey(Down|Up|Press)/.test(openTag)
    if (!ok) offenders.push(`${file}:${src.slice(0, idx).split('\n').length} <${tagName}>`)
  }
  return offenders
}

describe('a11y fitness — 클릭 요소의 키보드 조작 가능성', () => {
  const files = scanFiles()

  it('스캐너가 파일을 실제로 읽는다', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('키보드로 조작 못 하는 clickable 비인터랙티브 요소가 없다(장식 백드롭 제외)', () => {
    const offenders = files.flatMap(findKeyboardOffenders)
    expect(offenders, `키보드 조작 불가 clickable(role+tabIndex+onKeyDown 또는 aria-hidden 필요):\n${offenders.join('\n')}`).toEqual([])
  })
})
