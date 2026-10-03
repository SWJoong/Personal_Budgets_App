import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * QA 실행 기록 표 계약 — `qa.dir`(docs/release/qa-runs) 실행 파일의 항목 표가 플러그인 `qa-run.sh close` 의 집계 모양과
 * 맞는다 (W 레인).
 *
 * 배경: doc18 §9 ⑧(b)(#207 verify-pr — QA 표 결과 칸 ↔ qa-run close 파서, D-20260930-01 조건). 설치본 0.4.0 `close` 는
 *   `^\| [0-9]+ \|[^|]*\| *PASS` 로 센다 = 숫자 첫 칸 행의 **세 번째 칸**이 결과다(칸 위치를 머리 행에서 찾지 않는다).
 *   `#` 칸을 빼거나(README 의 `항목 | 결과 | …` 모양 그대로) 결과 앞에 칸을 더하거나, 결과를 굵게(`**PASS**`) 쓰거나,
 *   항목 칸에 `|` 가 들어가면 집계가 조용히 틀린다(PASS 가 미기입으로) — 사람 자리 기록 `[QA by user] PASS n / FAIL m` 의 숫자.
 *   플러그인 0.4.2 후보(doc18 §9 ⑨)가 `close` 의 칸 탐지를 넣더라도 이 계약은 현 기록 파일의 표 일관성을 지킨다.
 *
 * 판정 모양: `close` 와 같게 줄을 `|` 로 그대로 자른다(이스케이프 `\|`·백틱 안의 `|` 도 칸을 가른다 — awk -F'|' 와 같음).
 *   항목 표 = 머리 첫 칸이 `#` 이거나 숫자 첫 칸 행(`| N |`)을 가진 표. README.md 는 실행 파일이 아니라 제외.
 *
 * 저작 시점(af100bf) 판정: 실행 파일 1개(2026-09-29-harness-live.md, 항목 13) — 회귀 가드(GREEN).
 */

const ROOT = process.cwd()
const DEFAULT_QA_DIR = 'docs/release/qa-runs'

/** `close` 가 세는 항목 행(정규식 문자열 그대로 — 첫 칸 앞뒤 공백 1칸·숫자). */
const COUNTED_ROW_RE = /^\| [0-9]+ \|/
/** `close` 가 결과로 읽는 값 — 칸 앞 공백 뒤 바로 PASS/FAIL/SKIP(굵게·따옴표 없음). 빈 칸 = 미기입. */
const RESULT_CELL_RE = /^ *(?:PASS|FAIL|SKIP)/
const RESULT_HEADER = '결과'
const RESULT_COLUMN = 3 // `|` 로 자른 조각 번호(0 = 첫 `|` 앞 빈 조각) — 1: #, 2: 항목, 3: 결과

/** harness.json `qa.dir` — 플러그인 qa-run.sh 와 같은 키·기본값. */
function qaDir(): string {
  try {
    const parsed = JSON.parse(readFileSync(join(ROOT, '.claude/harness.json'), 'utf8')) as { qa?: { dir?: unknown } }
    return typeof parsed.qa?.dir === 'string' && parsed.qa.dir.length > 0 ? parsed.qa.dir : DEFAULT_QA_DIR
  } catch {
    return DEFAULT_QA_DIR
  }
}

/** 실행 파일(README.md 제외 `.md`, 저장소 상대경로, 정렬). */
function runFiles(): string[] {
  const dir = qaDir()
  return readdirSync(join(ROOT, dir))
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => `${dir}/${name}`)
}

type Table = { startLine: number; header: string; rows: Array<{ line: number; text: string }> }

/** 마크다운 표 블록(`|` 로 시작하는 연속 줄) — 머리 행·구분 행 다음이 본문 행. */
function tables(markdown: string): Table[] {
  const out: Table[] = []
  let cur: string[] = []
  let start = 0
  const lines = markdown.split(/\r?\n/)
  const flush = () => {
    if (cur.length > 0) out.push({ startLine: start, header: cur[0], rows: cur.slice(2).map((text, i) => ({ line: start + 2 + i, text })) })
    cur = []
  }
  lines.forEach((line, i) => {
    if (line.startsWith('|')) {
      if (cur.length === 0) start = i + 1
      cur.push(line)
    } else flush()
  })
  flush()
  return out
}

const cells = (row: string) => row.split('|')
const isItemTable = (t: Table) => cells(t.header)[1]?.trim() === '#' || t.rows.some((r) => COUNTED_ROW_RE.test(r.text))

describe('QA 실행 기록 표 계약 — qa-run.sh close 집계 모양', () => {
  it('실행 파일마다 항목 표가 있고, 항목 표의 머리 행 세 번째 칸이 「결과」다(close 가 세 번째 칸을 센다)', () => {
    // 표 파서 자기검증(체커 유효성).
    const sample = '# x\n\n| # | 항목 | 결과 | 증거 |\n|---|---|---|---|\n| 1 | a | PASS | e |\n\n| 발견 | 비고 |\n|---|---|\n| y | z |\n'
    expect(
      tables(sample).map((t) => [t.startLine, isItemTable(t), cells(t.header)[RESULT_COLUMN]?.trim(), t.rows.length]),
      'QA 표 파서(체커) 자체 버그',
    ).toEqual([
      [3, true, RESULT_HEADER, 1],
      [7, false, '', 1],
    ])

    const files = runFiles()
    expect(files.length, `${qaDir()} 에 실행 파일이 없음 — 기록 폴더를 옮겼으면 harness.json qa.dir 와 이 계약을 함께 고친다`).toBeGreaterThan(0)
    const problems = files.flatMap((rel) => {
      const itemTables = tables(readFileSync(join(ROOT, rel), 'utf8')).filter(isItemTable)
      if (itemTables.length === 0) return [`${rel}: 항목 표(머리 첫 칸 \`#\` 또는 \`| N |\` 행) 없음 — close 가 항목 0개로 센다`]
      return itemTables
        .filter((t) => !cells(t.header)[RESULT_COLUMN]?.trim().startsWith(RESULT_HEADER))
        .map((t) => `${rel}:${t.startLine}: 머리 행 세 번째 칸 = ${JSON.stringify(cells(t.header)[RESULT_COLUMN]?.trim())}`)
    })
    expect(
      problems,
      'QA 실행 파일의 항목 표 머리 행 세 번째 칸이 「결과」가 아님 — qa-run.sh close 가 다른 칸을 결과로 세어 PASS/FAIL 집계([QA by user] 기록의 숫자)가 틀린다. 표는 `| # | 항목 | 결과 | …` 순서를 지킨다',
    ).toEqual([])
  })

  it('항목 표의 본문 행이 모두 close 가 세는 모양(`| N |`)이고, 머리 행과 칸 수가 같으며, 세 번째 칸이 PASS·FAIL·SKIP 로 시작하거나 비어 있다', () => {
    const problems = runFiles().flatMap((rel) =>
      tables(readFileSync(join(ROOT, rel), 'utf8'))
        .filter(isItemTable)
        .flatMap((t) => {
          const width = cells(t.header).length
          return t.rows.flatMap(({ line, text }) => {
            const where = `${rel}:${line}`
            if (!COUNTED_ROW_RE.test(text)) return [`${where}: close 가 세지 않는 행 모양(첫 칸 \`| N |\` 아님) — ${text.slice(0, 40)}`]
            const parts = cells(text)
            if (parts.length !== width) return [`${where}: 칸 수 ${parts.length - 2} ≠ 머리 ${width - 2}(항목·결과 칸의 \`|\` 가 칸을 가른다)`]
            const result = parts[RESULT_COLUMN]
            return result.trim() === '' || RESULT_CELL_RE.test(result) ? [] : [`${where}: 결과 칸 ${JSON.stringify(result.trim().slice(0, 20))}`]
          })
        }),
    )
    expect(
      problems,
      'QA 실행 파일의 항목 행이 close 집계 모양과 다름 — 그 행이 항목 수에서 빠지거나 결과가 미기입으로 세진다(굵게 `**PASS**`·칸 안의 `|`·`|1|` 모양)',
    ).toEqual([])
  })
})
