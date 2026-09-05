import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P7 웨이브3 — no-budget 게이트 중복 제거 (A7) · 계약: nobudget.gate.adopt (RED-fsscan)
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §5(NoBudgetGate 채택 매핑)
 *
 * 감사 근거(A7): 게이트 본문 '아직 예산 …없어요 / 담당 선생님에게 말씀해 주세요' 가 7파일에 중복,
 *   각기 다른 시각 셸 + 이모지 aria-hidden 불일치. 공유 NoBudgetGate 로 통일한다.
 *   화면별 헤더 제목(gallery '영수증 모아보기' 등)은 유지 — 공유 대상은 게이트 '본문'만.
 *
 * 단언:
 *   (1) 7파일 각각이 '@/components/ui/NoBudgetGate' 를 import 하고 <NoBudgetGate 를 렌더한다.
 *   (2) 게이트 본문 원문 '담당 선생님에게 말씀해 주세요' 가 src 전체에서 NoBudgetGate.tsx 밖으로
 *       0회 등장(문구표준상 컴포넌트는 '말해 주세요' 로 단순화하므로 이 원문은 완전 소멸해야 한다).
 *
 * RED 이유: 오늘 7파일은 인라인 하드코딩 + NoBudgetGate import 0. rg 로 '말씀해 주세요' 7회 검출 → RED.
 */

const ROOT = process.cwd()
const FILES = [
  'src/app/(participant)/page.tsx',
  'src/app/(participant)/calendar/page.tsx',
  'src/app/(participant)/gallery/page.tsx',
  'src/app/(participant)/map/page.tsx',
  'src/app/(participant)/my-plan/page.tsx',
  'src/app/(participant)/receipt/page.tsx',
  'src/app/(participant)/receipt/ReceiptClient.tsx',
]

const IMPORT_RE = /import\s*\{[^}]*\bNoBudgetGate\b[^}]*\}\s*from\s*['"]@\/components\/ui\/NoBudgetGate['"]/
const OLD_BODY = '담당 선생님에게 말씀해 주세요'

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

// src 트리 전체 .ts/.tsx 를 훑어 원문 게이트 본문이 남았는지 검사(NoBudgetGate.tsx 는 제외).
function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${ent.name}`
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue
      walk(rel, acc)
    } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.(test|spec)\.tsx?$/.test(ent.name)) {
      // 테스트/스펙 파일(W 레인)은 계약이 문구를 인용하므로 스캔 대상에서 제외.
      acc.push(rel)
    }
  }
  return acc
}

describe('P7-C nobudget — NoBudgetGate 공유 채택 (nobudget.gate.adopt)', () => {
  it.each(FILES)('[RED] %s 가 NoBudgetGate 를 import 한다', (rel) => {
    expect(IMPORT_RE.test(read(rel))).toBe(true)
  })

  it.each(FILES)('[RED] %s 가 <NoBudgetGate 를 렌더한다', (rel) => {
    expect(read(rel)).toMatch(/<NoBudgetGate[\s/>]/)
  })

  it("[RED] 게이트 원문 '담당 선생님에게 말씀해 주세요' 가 NoBudgetGate.tsx 밖으로 남지 않는다", () => {
    const leaks = walk('src')
      .filter((rel) => rel !== 'src/components/ui/NoBudgetGate.tsx')
      .filter((rel) => read(rel).includes(OLD_BODY))
    expect(leaks).toEqual([])
  })
})
