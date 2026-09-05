import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P7 웨이브3 — 빈 상태 일관화 (A1) · 계약: emptystate.adopt.participant-lists (RED-fsscan)
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §1(EmptyState 채택 매핑) · §3(3상태 문구표준)
 *
 * 감사 근거(A1): 당사자 목록 6종이 EmptyState 프리미티브(rounded-2xl bg-muted 카드 + aria-hidden
 *   emoji + CTA)를 쓰지 않고 인라인 <p …text-muted-foreground …없어요> 로 흩어져 있다 →
 *   시각·구조 불일치, 다음 행동(G5) 안내 제각각.
 *
 * 이 계약은 정적 회귀 잠금(fs-scan)이다 — 6개 중 다수가 async RSC 라 jsdom 마운트가 어려워
 *   소스에서 import/사용/잔여 인라인마크업을 정규식으로 검사한다(선례: EmptyState.test.tsx 채택검사).
 * 단언 범위: import 존재 + '<EmptyState' 사용 + '없어요' 인라인 <p> 잔여 0 (색·토큰·정확한
 *   클래스 문자열은 단언하지 않는다). MyPlanClient·MapTabsClient 의 렌더 시맨틱은 별도
 *   emptystate.render.p7c.test.tsx 가 잠근다.
 *
 * RED 이유: 오늘 이 6파일은 EmptyState import 0건 + '없어요' 인라인 <p> >0건. U 채택 시 초록.
 */

const ROOT = process.cwd()
const FILES = [
  'src/app/(participant)/page.tsx',
  'src/app/(participant)/calendar/CalendarClient.tsx',
  'src/app/(participant)/plan/page.tsx',
  'src/app/(participant)/gallery/page.tsx',
  'src/app/(participant)/my-plan/MyPlanClient.tsx',
  'src/app/(participant)/map/MapTabsClient.tsx',
]

const IMPORT_RE = /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*['"]@\/components\/ui\/EmptyState['"]/

// 잔여 인라인 빈상태: 같은 <p …> 태그가 text-muted-foreground(또는 py-8/py-12) 클래스를 달고
// '없어요' 를 품는 형태. EmptyState 로 옮기면 0 이어야 한다.
const INLINE_EMPTY_RE =
  /<p[^>]*(?:text-muted-foreground|py-8|py-12)[^>]*>(?:(?!<\/p>)[\s\S])*?없어요/

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

describe('P7-C emptystate — 당사자 목록 6종 EmptyState 채택 (adopt.participant-lists)', () => {
  it.each(FILES)('[RED] %s 가 EmptyState 를 import 한다', (rel) => {
    expect(IMPORT_RE.test(read(rel))).toBe(true)
  })

  it.each(FILES)("[RED] %s 가 '<EmptyState' 를 최소 1회 사용한다", (rel) => {
    expect(read(rel)).toMatch(/<EmptyState[\s/>]/)
  })

  it.each(FILES)("[RED] %s 에 '없어요' 인라인 <p> 빈상태 잔여가 없다", (rel) => {
    // calendar 의 날짜선택 '이 날은 쓴 돈이 없어요' 도 목록레벨 빈상태라 EmptyState 로 이동해야 한다.
    expect(INLINE_EMPTY_RE.test(read(rel))).toBe(false)
  })

  it('[RED] plan·map 의 장식 emoji 는 독립 non-aria-hidden <span> 이 아니다 (A8 흡수)', () => {
    // EmptyState 의 emoji span 은 aria-hidden 이 구조상 보장 → 화면에서 raw <span class="text-6xl">이모지
    // 형태로 남으면 안 된다(EmptyState 로 흡수). 여기서는 '없어요' 텍스트를 품은 블록 인접에 남은
    // 장식 span 이 없는지만 본다(정확한 접근성 시맨틱은 EmptyState.test.tsx 가 보증).
    for (const rel of ['src/app/(participant)/plan/page.tsx', 'src/app/(participant)/map/MapTabsClient.tsx']) {
      expect(INLINE_EMPTY_RE.test(read(rel))).toBe(false)
    }
  })
})
