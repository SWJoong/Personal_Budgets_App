import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 가명처리 게이트 경계 — 아키텍처 적합성 테스트 (W).
 * 설계: Plan&Source/goala_privacy_deid_assignment_W.md §1-3.
 *
 * 강제 규칙: 서버 액션(src/app/actions/*.ts)은 원문 텍스트를 `callAI` 로 **직접** 보내지 않는다.
 *   텍스트→AI 는 반드시 가명처리 래퍼 `callAIDeidentified`(@/utils/aiDeidentify) 경유.
 *   예외: ocr.ts — 입력이 **이미지**라 텍스트 PII 가 없고 이미지는 de-id 대상이 아님(프롬프트에도 식별자 없음).
 *
 * 이 테스트가 잡는 것: 미래에 요약·활동제안 같은 액션이 `import { callAI } from '@/utils/ai'` 로
 *   원문을 바로 보내려 하면 CI 가 실패 → deidentify 게이트 우회를 차단. (현재는 ocr.ts 만 callAI 를
 *   쓰므로 GREEN. 게이트가 실제로 강제되는지 회귀로 고정한다.)
 */

const ACTIONS_DIR = join(process.cwd(), 'src/app/actions')
const EXEMPT = new Set(['ocr.ts']) // 이미지 OCR — 텍스트 PII 미포함, 이미지 de-id 불가

// 액션 파일에서 '@/utils/ai' 로부터 callAI 를 import 하는지( callAIDeidentified 는 제외 — \bcallAI\b 가
// "callAIDeidentified" 내부엔 걸리지 않는다. 뒤 문자 D 가 단어경계를 막기 때문).
const IMPORTS_CALL_AI = /import\s*\{[^}]*\bcallAI\b[^}]*\}\s*from\s*['"]@\/utils\/ai['"]/

describe('가명처리 게이트 경계 — 서버 액션의 직접 callAI 사용 금지(ocr 예외)', () => {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('스캐너가 액션 파일을 실제로 읽는다(적합성 테스트 살아있음)', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('ocr.ts 는 예외로 등록돼 있고 실제로 존재한다(예외가 유령이 아님)', () => {
    expect(files).toContain('ocr.ts')
  })

  for (const f of files) {
    if (EXEMPT.has(f)) continue
    it(`${f}: callAI 직접 import 금지 → callAIDeidentified 경유`, () => {
      const src = readFileSync(join(ACTIONS_DIR, f), 'utf8')
      expect(IMPORTS_CALL_AI.test(src)).toBe(false)
    })
  }
})
