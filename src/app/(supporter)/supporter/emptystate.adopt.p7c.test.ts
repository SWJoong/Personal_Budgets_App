import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P7 웨이브3 — 빈 상태 일관화 (A2) · 계약: emptystate.adopt.supporter-lists (RED-fsscan)
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §1(채택 매핑) · §3(3상태 문구표준) · §2(CTA href 맵)
 *
 * 감사 근거(A2): 실무자 목록도 EmptyState 미채택 + 빈상태에 '다음 행동' CTA 부재 →
 *   신규 기관에서 데드엔드. participants/plans/applications/evaluations 는 이미 L1 에 Link 를
 *   import 하고 있어 action prop 배선만 남았다. transactions 는 서버페이지 진짜0 = 온보딩 CTA.
 *
 * 정적 회귀 잠금(fs-scan): 이 목록의 대부분은 async RSC(서버) 라 render 로 잠글 수 없다.
 *   DocumentShelfClient(client) 의 렌더 시맨틱은 emptystate.render.p7c.test.tsx 가 별도로 잠근다.
 * 단언 범위: import + '<EmptyState' 사용 + '없어요' 인라인 <p> 잔여 0 + 다음행동 지정 화면의 action= 배선.
 *   OrgLedgerClient 의 기존 EmptyState 는 emptystate.render.filterzero 가 회귀 보증(여기선 안 건드림).
 *
 * RED 이유: 오늘 이 파일들은 EmptyState import 0 + action prop 0 + 인라인 <p …없어요> >0. U 채택 시 초록.
 */

const ROOT = process.cwd()
const B = 'src/app/(supporter)/supporter'

// 6종 전부: import + 사용 + 인라인 잔여0
const ALL = [
  `${B}/transactions/page.tsx`,
  `${B}/participants/page.tsx`,
  `${B}/plans/page.tsx`,
  `${B}/applications/page.tsx`,
  `${B}/evaluations/page.tsx`,
  `${B}/documents/DocumentShelfClient.tsx`,
]

// 다음 행동(CTA) 이 정의된 화면 — action= prop 이 반드시 있어야 한다(데드엔드 제거).
// transactions 서버페이지 진짜0 = 온보딩 CTA 필수 포함.
const NEEDS_ACTION = [
  `${B}/transactions/page.tsx`,
  `${B}/participants/page.tsx`,
  `${B}/plans/page.tsx`,
  `${B}/applications/page.tsx`,
  `${B}/evaluations/page.tsx`,
]

const IMPORT_RE = /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*['"]@\/components\/ui\/EmptyState['"]/
const INLINE_EMPTY_RE =
  /<p[^>]*(?:text-muted-foreground|py-8|py-12)[^>]*>(?:(?!<\/p>)[\s\S])*?없어요/

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('P7-C emptystate — 실무자 목록 EmptyState 채택 (adopt.supporter-lists)', () => {
  it.each(ALL)('[RED] %s 가 EmptyState 를 import 한다', (rel) => {
    expect(IMPORT_RE.test(read(rel))).toBe(true)
  })

  it.each(ALL)("[RED] %s 가 '<EmptyState' 를 사용한다", (rel) => {
    expect(read(rel)).toMatch(/<EmptyState[\s/>]/)
  })

  it.each(ALL)("[RED] %s 에 '없어요' 인라인 <p> 빈상태 잔여가 없다", (rel) => {
    expect(INLINE_EMPTY_RE.test(read(rel))).toBe(false)
  })

  it.each(NEEDS_ACTION)('[RED] %s 의 빈상태가 다음 행동 CTA(action=)를 배선한다', (rel) => {
    // {label, href} 객체 또는 ReactNode 컨트롤. EmptyState 내부가 next/link 를 렌더하므로
    // 페이지가 직접 Link 를 import 하지 않아도 action prop 만 있으면 role=link 가 생긴다.
    expect(read(rel)).toMatch(/\baction=/)
  })

  it('[GREEN-lock] OrgLedgerClient 의 기존 EmptyState 채택이 회귀하지 않는다', () => {
    // 크로스체크: 이 파일은 이미 EmptyState 를 쓴다(필터0). 채택이 제거되면 안 된다.
    const src = read(`${B}/transactions/OrgLedgerClient.tsx`)
    expect(IMPORT_RE.test(src)).toBe(true)
    expect(src).toMatch(/<EmptyState[\s/>]/)
  })
})
