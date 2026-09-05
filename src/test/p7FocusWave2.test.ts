import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P7 웨이브2 — 포커스·인터랙션 복구 RED 계약 (W 저작, U 초록화).
 * 설계: Plan&Source/goala_p7_focus_W.md (focus-visible 복원방식 · C1 @keyframes 정의 ·
 *       D2 색 수렴 · 수동 픽셀 QA 체크리스트).
 *
 * 감사 evidence:
 *   D1 [high]  focus:outline-none 46곳(16파일)이 전역 focus-visible 링을 무력화 → 키보드 포커스 위치 소실.
 *   D2 [med]   focus 링 색 3종(foreground·muted-foreground·primary) 난립 → 단일 토큰(primary)으로 수렴.
 *   C1 [high]  모바일 드로어 slide-in-from-* 가 죽은 클래스(tailwindcss-animate 미설치) → 애니 미작동.
 *   D9 [low]   login 로고 focus:outline-none 대체링 없음 → 포커스 복원.
 *
 * 계약 성격(파일-텍스트 스캔, 런타임 없음):
 *   - fs-scan 은 className 문자열의 "클래스 존재"만 단언한다. 실제 3px 링 픽셀·슬라이드 모션은
 *     jsdom/fs 로 볼 수 없다 → 설계문(cssGuidance)의 수동 픽셀 QA 체크리스트가 그 층을 덮는다.
 *   - D11(Modal 배경 inert)은 런타임 계약이라 src/components/ui/Modal.test.tsx 에서 별도로 잠근다.
 *
 * RED(HEAD 확인): focus:outline-none 46 · focus-visible:ring 0 · focus:ring-muted-foreground 15 ·
 *   focus:ring-foreground 24 · globals.css slide-in keyframe 부재 · 두 드로어 dead class 존재.
 *   U(app-6c)가 설계문대로 구현하면 초록. src 구현 변경은 U 레인 — W 는 계약·설계문만 저작한다.
 */

const ROOT = process.cwd()

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8')
}

/** src 트리의 모든 .tsx 를 (레포 상대경로로) 수집한다. D2 는 소스 전체를 스캔한다. */
function walkTsx(rel: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
    const child = `${rel}/${e.name}`
    if (e.isDirectory()) out.push(...walkTsx(child))
    else if (e.name.endsWith('.tsx')) out.push(child)
  }
  return out
}

/**
 * 한 파일에서 className 속성값(문자열)을 전부 추출한다. 세 형태 지원:
 *   className="..."  ·  className='...'  ·  className={`...${...}...`}(중괄호 균형 추적).
 * template literal 은 ${...} 의 중괄호까지 균형 계산해 통째로 한 문자열로 잡으므로,
 * PreviewBanner 처럼 focus:outline-none 과 focus-visible:ring-2 가 같은 className 안에
 * 있는 케이스를 "같은 문자열"로 올바르게 평가한다.
 */
function extractClassStrings(src: string): string[] {
  const out: string[] = []
  const re = /className\s*=\s*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const i = m.index + m[0].length
    const delim = src[i]
    if (delim === '"' || delim === "'") {
      const end = src.indexOf(delim, i + 1)
      if (end > i) out.push(src.slice(i + 1, end))
    } else if (delim === '{') {
      let depth = 0
      let j = i
      for (; j < src.length; j++) {
        const c = src[j]
        if (c === '{') depth++
        else if (c === '}') {
          depth--
          if (depth === 0) break
        }
      }
      out.push(src.slice(i + 1, j))
    }
  }
  return out
}

/**
 * BARE focus:outline-none = className 문자열이 /focus:outline-none/ 를 포함하면서
 * 같은 문자열 안에 폭을 가진 /focus-visible:ring-(1|2|4)/ 를 동반하지 않는 경우.
 * GREEN(발생당) = (a) focus:outline-none 제거해 전역 :focus-visible 3px primary 링 상속, 또는
 *                (b) 같은 문자열에 focus-visible:ring-N 동반.
 * 순수 :focus 색상전용 동반(focus:ring-foreground/muted-foreground/primary, focus-visible: 미부착)은
 * 규칙을 만족하지 못한다 — 폭 링은 반드시 focus-visible: 변형이어야 한다. (D1 가시성 + D2 색을 동시에 강제)
 */
function bareOutlineNoneCount(src: string): number {
  let n = 0
  for (const s of extractClassStrings(src)) {
    if (/focus:outline-none/.test(s) && !/focus-visible:ring-(1|2|4)/.test(s)) n++
  }
  return n
}

function countSubstr(hay: string, needle: string): number {
  return hay.split(needle).length - 1
}

// ── D1 + D9: focus:outline-none 무력화 대상 16 파일(umbrella fs-scan) ──
const D1_FILES = [
  'src/app/(auth)/login/page.tsx', // D9: 로고 focus:outline-none, 동반 링 없음
  'src/app/(participant)/my-plan/MyPlanClient.tsx',
  'src/app/(participant)/receipt/ReceiptClient.tsx', // 5곳 no-ring
  'src/app/(supporter)/admin/invitations/InvitationsClient.tsx',
  'src/app/(supporter)/admin/participants/[id]/ParticipantDetailClient.tsx',
  'src/app/(supporter)/admin/participants/new/page.tsx',
  'src/app/(supporter)/supporter/[participantId]/assessment/AssessmentClient.tsx',
  'src/app/(supporter)/supporter/[participantId]/transactions/new/NewTransactionClient.tsx',
  'src/app/(supporter)/supporter/applications/[id]/ApplicationDetailClient.tsx',
  'src/app/(supporter)/supporter/applications/new/page.tsx',
  'src/app/(supporter)/supporter/evaluations/[participantId]/EvaluationClient.tsx',
  'src/app/(supporter)/supporter/plans/[id]/PlanDetailClient.tsx',
  'src/app/(supporter)/supporter/plans/new/NewPlanClient.tsx',
  'src/app/(supporter)/supporter/review/ReviewQueueClient.tsx',
  'src/components/admin/PreviewBanner.tsx', // 색 배너 → focus-visible:ring-2 동반 허용
  'src/components/map/PlaceSearch.tsx',
] as const

describe('P7 웨이브2 · D1+D9 — focus-visible 링 상속/동반 골든(fs-scan)', () => {
  it.each(D1_FILES)('%s 에 BARE focus:outline-none 이 없다(상속 or focus-visible:ring-N 동반)', (rel) => {
    expect(bareOutlineNoneCount(read(rel))).toBe(0)
  })

  it('집계 가드: 16 파일 전체 BARE focus:outline-none 합계 === 0 (RED 현재 46)', () => {
    const total = D1_FILES.reduce((sum, rel) => sum + bareOutlineNoneCount(read(rel)), 0)
    expect(total).toBe(0)
  })

  it('D9: login 로고 컨트롤(대체링 없던 focus:outline-none)이 규칙을 만족한다', () => {
    expect(bareOutlineNoneCount(read('src/app/(auth)/login/page.tsx'))).toBe(0)
  })

  it('ReceiptClient 의 5개 no-ring 입력이 모두 규칙을 만족한다(상속 or focus-visible:ring-N)', () => {
    expect(bareOutlineNoneCount(read('src/app/(participant)/receipt/ReceiptClient.tsx'))).toBe(0)
  })

  it('가드: 새 폭 링은 반드시 focus-visible: 변형이어야 한다(bare focus:ring-N 로 회귀 금지)', () => {
    // 소스 어디에도 bare `focus:ring-` 로 폭(1/2/4)을 부여해선 안 된다.
    // (focus-visible:ring-2 는 "focus:ring-" 부분문자열을 포함하지 않으므로 오탐 없음.)
    const all = walkTsx('src').map(read).join('\n')
    expect(countSubstr(all, 'focus:ring-1')).toBe(0)
    expect(countSubstr(all, 'focus:ring-2')).toBe(0)
    expect(countSubstr(all, 'focus:ring-4')).toBe(0)
  })
})

// ── D2: focus 링 색 토큰 단일화(primary 로 수렴) ──
describe('P7 웨이브2 · D2 — focus-ring 색 토큰 수렴(fs-scan, src 전체)', () => {
  const ALL = walkTsx('src').map(read).join('\n')

  it('저대비 focus:ring-muted-foreground 가 소스 전체에서 0 (RED 현재 15)', () => {
    expect(countSubstr(ALL, 'focus:ring-muted-foreground')).toBe(0)
  })

  it('bare focus:ring-foreground 가 소스 전체에서 0 (RED 현재 24)', () => {
    expect(countSubstr(ALL, 'focus:ring-foreground')).toBe(0)
  })

  it('PreviewBanner 컨텍스트 링은 bare focus: 변형이 아니다(focus-visible:ring-2 변형만 허용)', () => {
    const src = read('src/components/admin/PreviewBanner.tsx')
    expect(countSubstr(src, 'focus:ring-info-solid-foreground')).toBe(0)
    expect(countSubstr(src, 'focus:ring-warning-foreground')).toBe(0)
  })

  it('globals.css :focus-visible 전역 규칙(outline 3px var(--color-primary))이 유일한 색 근원으로 유지', () => {
    const css = read('src/app/globals.css')
    // :focus-visible { ... outline: 3px solid var(--color-primary) ... }
    expect(/:focus-visible\s*\{[^}]*outline:\s*3px\s+solid\s+var\(--color-primary\)/.test(css)).toBe(true)
  })
})

// ── C1: 모바일 드로어 slide-in 키프레임 정의 + dead class 제거 ──
describe('P7 웨이브2 · C1 — 드로어 slide-in @keyframes(fs-scan)', () => {
  const CSS = read('src/app/globals.css')
  const NAV = read('src/components/layout/NavDropdown.tsx')
  const SUP = read('src/app/(supporter)/SupporterLayoutClient.tsx')

  it('globals.css 가 @keyframes slide-in-right / slide-in-left 를 정의한다', () => {
    expect(/@keyframes\s+slide-in-right\b/.test(CSS)).toBe(true)
    expect(/@keyframes\s+slide-in-left\b/.test(CSS)).toBe(true)
  })

  it('globals.css 가 .animate-slide-in-right / .animate-slide-in-left 유틸을 정의한다', () => {
    expect(/\.animate-slide-in-right\b/.test(CSS)).toBe(true)
    expect(/\.animate-slide-in-left\b/.test(CSS)).toBe(true)
  })

  it('NavDropdown 에 죽은 플러그인 API(animate-in / slide-in-from-)가 없고 새 유틸을 참조한다', () => {
    expect(NAV.includes('slide-in-from-')).toBe(false)
    expect(NAV.includes('animate-in')).toBe(false)
    expect(NAV.includes('animate-slide-in-right')).toBe(true)
  })

  it('SupporterLayoutClient 에 죽은 플러그인 API 가 없고 새 유틸을 참조한다', () => {
    expect(SUP.includes('slide-in-from-')).toBe(false)
    expect(SUP.includes('animate-in')).toBe(false)
    expect(SUP.includes('animate-slide-in-left')).toBe(true)
  })
})
