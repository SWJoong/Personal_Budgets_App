import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * PR 템플릿 필드 계약 — `.github/pull_request_template.md` 의 「하네스」 필드 줄이 플러그인 머지 게이트가 읽는 이름과
 * 모양을 지킨다 (W 레인).
 *
 * 배경: doc18 §9 낮음(#199 4차 재검증 docs-consistency-6 — PR 템플릿 필드명 ↔ 게이트 `body_field` 정합 계약). 설치본 0.4.0
 *   `pr-merge-gate.sh` 의 `body_field`(sed 식 `^[-*][[:space:]]*<이름>[[:space:]]*:` 에 맞는 첫 줄의 콜론 뒤 값)가 PR 본문에서
 *   `검증 티어`(선언 티어 — 계산 티어와 높은 쪽 적용, `cut -d' ' -f1` 로 첫 낱말) · `계약 PR`(`#N` 들 — 계약 PR 닫기·
 *   same-context 판정) · `Manual-Ops`(`없음`·`none`·`N/A` 로 시작하지 않으면 `--manual-ops-ack` 요구) 세 필드를 읽는다.
 *   `verify-pr.js` 범위 단계도 본문의 `검증 티어:` 값을 declaredTier 로 읽는다. 템플릿이 이름(`계약PR`·`Manual Ops`)이나
 *   모양(`- **검증 티어**:` 굵게)을 바꾸면 게이트는 빈 값으로 읽어 선언 티어 unknown·계약 PR 미닫힘·Manual-Ops 확인 누락이
 *   조용히 일어난다. 나머지 4필드(유형·게이트·VERIFY REPORT·사용자 결정)는 사람·검증자가 읽는 필드라 줄 존재만 고정한다.
 *
 * 저작 시점(af100bf) 판정: 7필드 모두 있음 · 게이트 3필드 각각 한 줄로 읽힘 — 회귀 가드(GREEN).
 */

const ROOT = process.cwd()
const TEMPLATE = '.github/pull_request_template.md'

/** 템플릿 「하네스」 절의 필드 줄 접두(저작 시점 전체) — 줄머리 그대로(`- 이름:`). */
const TEMPLATE_FIELDS: readonly string[] = ['유형', '검증 티어', '계약 PR', '게이트', 'VERIFY REPORT', 'Manual-Ops', '사용자 결정']

/** 플러그인 머지 게이트(설치본 0.4.0 pr-merge-gate.sh 의 body_field 호출 67·98·120·145·159행)가 읽는 필드 이름. */
const GATE_BODY_FIELDS: readonly string[] = ['검증 티어', '계약 PR', 'Manual-Ops']

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** body_field 의 sed 식과 같은 줄 판정 — `^[-*][[:space:]]*이름[[:space:]]*:[[:space:]]*` (POSIX 공백 = JS `[ \t]` 로 충분: 한 줄 단위). */
function bodyFieldLines(body: string, name: string): string[] {
  const re = new RegExp(`^[-*][ \\t\\f\\v]*${escapeRegExp(name)}[ \\t\\f\\v]*:[ \\t\\f\\v]*`)
  return body.split(/\r?\n/).filter((line) => re.test(line))
}

/** body_field 가 돌려주는 값(첫 줄의 콜론 뒤, 끝 공백 제거) — 없으면 ''. */
function bodyField(body: string, name: string): string {
  const re = new RegExp(`^[-*][ \\t\\f\\v]*${escapeRegExp(name)}[ \\t\\f\\v]*:[ \\t\\f\\v]*`)
  const line = bodyFieldLines(body, name)[0]
  return line === undefined ? '' : line.replace(re, '').replace(/\s+$/, '')
}

describe('PR 템플릿 필드 계약 — .github/pull_request_template.md ↔ 플러그인 머지 게이트 body_field', () => {
  it('템플릿이 하네스 필드 7줄(- 유형: · - 검증 티어: · - 계약 PR: · - 게이트: · - VERIFY REPORT: · - Manual-Ops: · - 사용자 결정:)을 줄머리 그대로 가진다', () => {
    const lines = readFileSync(join(ROOT, TEMPLATE), 'utf8').split(/\r?\n/)
    expect(
      TEMPLATE_FIELDS.filter((name) => !lines.some((line) => line.startsWith(`- ${name}:`))),
      `${TEMPLATE} 에서 빠지거나 줄머리가 바뀐 필드(\`- 이름:\` 형식) — PR 작성자가 그 항목을 채우지 않고, 게이트·검증자가 읽는 항목이면 빈 값이 된다`,
    ).toEqual([])
  })

  it('머지 게이트가 읽는 필드(검증 티어·계약 PR·Manual-Ops)가 body_field 모양으로 템플릿에 정확히 한 줄씩 있고 값 자리가 비어 있지 않다', () => {
    // body_field 판정 자기검증(체커 유효성) — 굵게·띄어쓰기 변형·별표 머리·값 추출이 sed 식과 같다.
    expect(
      [
        bodyField('- 검증 티어: high — gate', '검증 티어'),
        bodyField('* 검증 티어 :  small  ', '검증 티어'),
        bodyField('- **검증 티어**: high', '검증 티어'),
        bodyField('- 계약PR: #12', '계약 PR'),
        bodyField('  - Manual-Ops: 없음', 'Manual-Ops'),
      ],
      'body_field 판정(체커) 자체 버그',
    ).toEqual(['high — gate', 'small', '', '', ''])

    const body = readFileSync(join(ROOT, TEMPLATE), 'utf8')
    expect(
      GATE_BODY_FIELDS.filter((name) => !TEMPLATE_FIELDS.includes(name)),
      '계약 버그: 게이트가 읽는 필드가 템플릿 필드 목록에 없음',
    ).toEqual([])
    const problems = GATE_BODY_FIELDS.flatMap((name) => {
      const hits = bodyFieldLines(body, name)
      if (hits.length !== 1) return [`${name}: body_field 모양 줄 ${hits.length}개(기대 1 — 0 이면 게이트가 빈 값, 2 이상이면 첫 줄만 읽음)`]
      return bodyField(body, name) === '' ? [`${name}: 값 자리가 비어 있음`] : []
    })
    expect(
      problems,
      `${TEMPLATE} 의 게이트 필드가 플러그인 pr-merge-gate.sh body_field(\`^[-*] *이름 *:\`)로 읽히지 않음 — 선언 티어 unknown·계약 PR 닫기 누락·Manual-Ops 확인 누락이 조용히 일어난다`,
    ).toEqual([])
  })
})
