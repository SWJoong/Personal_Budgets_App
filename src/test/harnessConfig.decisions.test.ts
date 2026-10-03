import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 결정 ID 인용 계약 — CLAUDE.md 가 인용한 `D-YYYYMMDD-NN` 이 모두 `docs/release/decisions.md` 표의 행 ID 로 있다 (W 레인).
 *
 * 배경: doc18 §9 ⑧(a)(#207 verify-pr tests-mutation-2 — 그 PR 이 바꾼 문서 줄을 조이는 계약이 없어 돌연변이 7종 생존).
 *   CLAUDE.md 「현재 작업 현황」·「레인 규칙」 은 결정을 ID 로만 가리키고, 결정의 근거·선택지·후속은 결정 로그 행에만 있다.
 *   인용 ID 가 로그에 없으면(오타·행 누락·번호 착오) 요약이 말하는 결정의 근거를 아무도 찾을 수 없다 — 사람 자리(W) 결정의
 *   3곳 기록(현황 · 결정 로그 · `post w [DECISION by user]`) 중 정본인 결정 로그와 요약이 어긋난 것이다.
 *
 * 규칙: 행 ID = 표 행의 첫 칸. `D-… 정정` 행(기록 정정 — 결정 로그 머리말 「행은 수정하지 않고 새 행으로 정정한다」)도 같은
 *   ID 로 인정한다. 인용 표기는 단독(`D-20261002-02`)·범위(`D-20260927-02~06` = 02·03·04·05·06)·나열(`D-20260928-01/02`,
 *   `D-20261001-01·02`)을 모두 펼쳐 각각을 대조한다(펼치지 않으면 `~07` 처럼 없는 끝 번호가 숨는다).
 *
 * 저작 시점(af100bf) 판정: CLAUDE.md 인용 15개(범위·나열을 펼친 뒤 중복 제거) 모두 로그 행 23개(정정 2행 포함, ID 21개)에 있음 —
 *   어긋난 인용 없음, 회귀 가드(GREEN).
 */

const ROOT = process.cwd()
const CLAUDE_MD = 'CLAUDE.md'
const DECISIONS_MD = 'docs/release/decisions.md'

/** 인용: `D-YYYYMMDD-NN` 과 뒤따르는 `~NN`·`/NN`·`·NN` 꼬리(두 자리 뒤에 숫자가 더 오면 꼬리가 아니다). */
const CITATION_RE = /D-(\d{8})-(\d{2})((?:[~/·]\d{2}(?!\d))*)/g

/** 표 행 첫 칸의 ID — `D-YYYYMMDD-NN` 또는 `D-YYYYMMDD-NN 정정`. */
const ROW_ID_RE = /^(D-\d{8}-\d{2})(?: 정정)?$/

/** 텍스트의 결정 인용을 펼친 ID 들(등장 순서, 중복 제거). */
function citedDecisionIds(text: string): string[] {
  const ids: string[] = []
  for (const m of text.matchAll(CITATION_RE)) {
    const [, date, first, tail] = m
    let prev = Number(first)
    ids.push(`D-${date}-${first}`)
    for (const part of tail.match(/[~/·]\d{2}/g) ?? []) {
      const n = Number(part.slice(1))
      const from = part[0] === '~' ? prev + 1 : n
      for (let k = from; k <= n; k++) ids.push(`D-${date}-${String(k).padStart(2, '0')}`)
      prev = n
    }
  }
  return Array.from(new Set(ids))
}

/** 결정 로그 표의 행 ID 집합(첫 칸이 ID 모양인 행만 — 머리 행·구분 행은 제외). */
function decisionRowIds(markdown: string): Set<string> {
  const ids = new Set<string>()
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue
    const m = ROW_ID_RE.exec((line.split('|')[1] ?? '').trim())
    if (m) ids.add(m[1])
  }
  return ids
}

describe('결정 ID 인용 계약 — CLAUDE.md ↔ docs/release/decisions.md', () => {
  it('CLAUDE.md 가 인용한 D-YYYYMMDD-NN(범위·나열 표기는 펼쳐서)이 모두 결정 로그 표의 행 ID(「 정정」 행 포함)로 있다', () => {
    // 추출기·파서 자기검증(체커 유효성) — 범위·나열 꼬리를 펼치고, 날짜 같은 긴 숫자는 꼬리로 읽지 않고, 정정 행을 인정한다.
    expect(
      [
        citedDecisionIds('(D-20260927-02~06, D-20260928-01/02) · D-20261001-01·02 기록 · D-20261002-01·2026-10-02'),
        Array.from(decisionRowIds('| ID | 날짜 |\n|---|---|\n| D-20260101-01 | x |\n| D-20260101-02 정정 | y |\n| D-2026010-03 | z |')),
      ],
      '결정 ID 추출기·행 파서(체커) 자체 버그',
    ).toEqual([
      ['D-20260927-02', 'D-20260927-03', 'D-20260927-04', 'D-20260927-05', 'D-20260927-06', 'D-20260928-01', 'D-20260928-02', 'D-20261001-01', 'D-20261001-02', 'D-20261002-01'],
      ['D-20260101-01', 'D-20260101-02'],
    ])

    const rows = decisionRowIds(readFileSync(join(ROOT, DECISIONS_MD), 'utf8'))
    expect(rows.size, `${DECISIONS_MD} 표에서 결정 행을 하나도 못 읽음 — 표 형식(첫 칸 = ID)이 바뀌었으면 이 계약도 함께 고친다`).toBeGreaterThan(0)
    const cited = citedDecisionIds(readFileSync(join(ROOT, CLAUDE_MD), 'utf8'))
    expect(cited.length, `${CLAUDE_MD} 에서 결정 인용을 하나도 못 읽음 — 인용 표기가 바뀌었으면 이 계약도 함께 고친다`).toBeGreaterThan(0)
    expect(
      cited.filter((id) => !rows.has(id)),
      `${CLAUDE_MD} 가 인용했지만 ${DECISIONS_MD} 표에 행이 없는 결정 ID — 요약이 가리키는 결정의 근거·선택지·후속을 찾을 수 없다(인용 오타·행 누락·범위 끝 번호 착오). 결정이면 로그에 행을 더하고, 오타면 인용을 고친다`,
    ).toEqual([])
  })
})
