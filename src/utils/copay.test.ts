/**
 * 계약(골든) 테스트 — 본인부담금 표시 규칙 + TS↔DB 상태값 패리티.  [작성: W(설계·검증) / 파일럿]
 *
 * 이 테스트는 "구현이 이렇게 동작한다"의 기록이 아니라 "이렇게 동작해야 한다"는 **스펙**이다.
 * 발달장애인 당사자에게 돈 관련 정보를 잘못 보여주면 해가 되므로(예고 없는 청구·면제자에 금액 노출),
 * 아래 안전 속성을 골든으로 못 박는다. 구현(src/utils/copay.ts)은 U가 초록으로 유지한다.
 *
 * 이력: W 파일럿으로 `claude/db-ontology-rdf-format-tnf0qv`(f44316f)에만 있던 파일을 2026-09-27 main 에
 *   안착했다. 같은 때 패리티 가드(아래 「TS↔DB 패리티」)를 덧붙였다 — docs/release/14 P3 「copay TS 패리티」.
 *   DB 쪽 산정 계약은 Plan&Source/ontology/seoul/verify_06_copay.sql(트리거 실측)이 맡는다.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Intent } from '@/components/ui/StatusPill'
import { describeCopay, copayStatusLabel, copayIntent, type CopayStatus } from './copay'

// ── 전수 목록(타입으로 잠금) ──────────────────────────────────────────────
// ① `satisfies` — 목록에 CopayStatus 가 아닌 값이 끼면 tsc 실패.
// ② `_ALL_LISTED` — CopayStatus 에 새 값이 추가됐는데 목록에 없으면 tsc 실패.
// 그래서 상태가 하나 늘면 이 파일(과 아래 Record 표들)을 반드시 같이 고쳐야 한다.
const COPAY_STATUSES = [
  'not_applicable',
  'exempt_basic_livelihood',
  'exempt_near_poor',
  'charged',
  'unverified',
] as const satisfies readonly CopayStatus[]

type Unlisted = Exclude<CopayStatus, (typeof COPAY_STATUSES)[number]>
const _ALL_LISTED: [Unlisted] extends [never] ? true : false = true

// 상태별 기대값 — Record<CopayStatus, …> 라 키 누락·여분 키 모두 tsc 가 잡는다.
const EXPECTED_INTENT: Record<CopayStatus, Intent> = {
  exempt_basic_livelihood: 'success', // 확정된 좋은 상태
  exempt_near_poor: 'success',
  charged: 'info', // 정보성 사실(나중에 냄)
  unverified: 'warning', // 미결 — 주의 필요
  not_applicable: 'neutral', // 제도 없는 차수
}

describe('describeCopay — 당사자 화면 계약', () => {
  it('면제 대상(기초생활/차상위)은 입력 금액과 무관하게 0원으로 강제한다 [안전 속성]', () => {
    for (const s of ['exempt_basic_livelihood', 'exempt_near_poor']) {
      const r = describeCopay(s, 999_999) // 양수를 넣어도
      expect(r.show).toBe(true)
      expect(r.amount).toBe(0) // 절대 새어나오면 안 된다
      expect(r.pending).toBe(false)
      expect(r.title).toBe('내가 낼 돈은 없어요')
    }
  })

  it("'charged'는 실제 금액을 그대로 통과시키고, 예산에서 안 빠진다고 안내한다", () => {
    const r = describeCopay('charged', 240_000)
    expect(r).toMatchObject({ show: true, amount: 240_000, pending: false, title: '내가 낼 돈' })
    expect(r.note).toContain('빠지지 않아요')
  })

  it("'unverified'만 pending=true (시각적 구분 필요)", () => {
    const r = describeCopay('unverified', 240_000)
    expect(r).toMatchObject({ show: true, amount: 240_000, pending: true })
    expect(r.title).toContain('확인 중')
  })

  it("제도 없는 차수('not_applicable')·null·undefined·알 수 없는 값은 영역을 숨긴다 [혼란 방지]", () => {
    for (const s of ['not_applicable', null, undefined, 'weird_value']) {
      const r = describeCopay(s as string | null | undefined, 100_000)
      expect(r.show).toBe(false)
      expect(r.amount).toBe(0)
    }
  })

  it('전 상태: not_applicable 만 숨기고, 보이는 상태는 제목·설명이 비지 않는다', () => {
    for (const s of COPAY_STATUSES) {
      const r = describeCopay(s, 240_000)
      expect(r.show, s).toBe(s !== 'not_applicable')
      if (r.show) {
        expect(r.title, s).not.toBe('')
        expect(r.note, s).not.toBe('')
      }
      // pending 은 오직 unverified — 다른 상태가 "확인 중"으로 보이면 확정 금액을 흐리게 된다.
      expect(r.pending, s).toBe(s === 'unverified')
    }
  })
})

describe('copayStatusLabel — 실무자 화면 계약', () => {
  it('상태별 한국어 라벨이 당사자용 쉬운 말과 목적이 다르다', () => {
    expect(copayStatusLabel('exempt_basic_livelihood')).toBe('면제 (기초생활수급)')
    expect(copayStatusLabel('exempt_near_poor')).toBe('면제 (차상위)')
    expect(copayStatusLabel('charged')).toBe('부과')
    expect(copayStatusLabel('unverified')).toBe('수급 구분 미확인')
    expect(copayStatusLabel('not_applicable')).toBe('해당 없음 (부담금 제도 없는 차수)')
    expect(copayStatusLabel('weird')).toBe('알 수 없음')
  })

  it("전 상태: 어느 상태도 '알 수 없음'으로 떨어지지 않는다 (라벨 누락 = 실무자 화면 공백)", () => {
    for (const s of COPAY_STATUSES) {
      expect(copayStatusLabel(s), s).not.toBe('알 수 없음')
    }
  })

  it('전 상태: 라벨이 서로 겹치지 않는다 (두 상태가 같은 말로 보이면 구분 불가)', () => {
    const labels = COPAY_STATUSES.map((s) => copayStatusLabel(s))
    expect(new Set(labels).size).toBe(COPAY_STATUSES.length)
  })
})

describe('copayIntent — StatusPill 색 의미 계약 (#93)', () => {
  it.each(COPAY_STATUSES.map((s): [CopayStatus, Intent] => [s, EXPECTED_INTENT[s]]))(
    "'%s' → %s",
    (status, intent) => {
      expect(copayIntent(status)).toBe(intent)
    },
  )

  it('null·undefined·알 수 없는 값은 중립(neutral) — 모르는 상태에 좋음/주의 색을 칠하지 않는다', () => {
    for (const s of [null, undefined, '', 'weird_value']) {
      expect(copayIntent(s)).toBe('neutral')
    }
  })

  it('면제는 success, 미확인은 warning — 미확인을 면제처럼 보이게 하면 안 된다 [안전 속성]', () => {
    expect(copayIntent('unverified')).not.toBe(copayIntent('exempt_basic_livelihood'))
    expect(copayIntent('unverified')).not.toBe(copayIntent('charged'))
  })
})

// ── TS↔DB 패리티 ─────────────────────────────────────────────────────────
// DB 정본(supabase/seoul/*.sql)의 copay_status CHECK·기본값·트리거 산출값과
// verify_06 계약이 다루는 상태가 TS CopayStatus 와 정확히 같아야 한다.
// 한쪽에만 상태가 늘면: DB 에만 → 화면이 '알 수 없음'/숨김으로 조용히 떨어짐,
// TS 에만 → 도달 불가능한 분기(죽은 코드)이거나 CHECK 위반으로 쓰기 실패.
const SEOUL_DIR = join(process.cwd(), 'supabase/seoul')
const VERIFY_06 = join(process.cwd(), 'Plan&Source/ontology/seoul/verify_06_copay.sql')

const sorted = (xs: Iterable<string>) => [...xs].sort()
const quoted = (s: string) => [...s.matchAll(/'([^']*)'/g)].map((m) => m[1])
const TS_SORTED = sorted(COPAY_STATUSES)

/**
 * verify_06 의 「C1~C6」 절(그 `=== ` 헤더 ~ 다음 `=== ` 절 헤더)에서 판정하는 copay_status 값 — 등장 순서·중복 그대로.
 * 파일 전체를 훑으면 C11·C12 재확인 시나리오에 같은 값이 다시 나와 C1~C6 판정 누락을 가린다. 그래서 절로 좁힌다.
 * 절을 못 찾으면 undefined(빨강으로 떨어진다).
 */
function c1to6Judged(verifySql: string): string[] | undefined {
  const block = verifySql.match(/^\\echo '=== C1~C6[^\n]*\n([\s\S]*?)(?=^\\echo '===|(?![\s\S]))/m)?.[1]
  return block === undefined
    ? undefined
    : [...block.matchAll(/copay_status\s*=\s*'([^']*)'/g)].map((m) => m[1])
}

/** 정본 빌드 SQL(verify_* 제외) — 파일명·본문 */
function seoulBuildSql(): { file: string; sql: string }[] {
  return readdirSync(SEOUL_DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('verify_'))
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(SEOUL_DIR, file), 'utf8') }))
}

describe('TS↔DB 패리티 — copay_status 값 목록', () => {
  const files = seoulBuildSql()

  // CHECK (copay_status IN ('a','b',…)) — 파일 어디에 있든 전부 모은다.
  const checkSites = files.flatMap(({ file, sql }) =>
    [...sql.matchAll(/copay_status\s+IN\s*\(([^)]*)\)/g)].map((m) => ({ file, values: quoted(m[1]) })),
  )

  it('스캐너가 CHECK 를 실제로 찾는다 — CREATE TABLE 인라인 + 기배포 DB 용 ALTER, 두 경로', () => {
    // 두 경로가 따로 있어 한쪽만 고치면 신규 DB 와 기존 DB 의 CHECK 가 갈라진다. 그래서 둘 다 대조한다.
    expect(checkSites.length).toBeGreaterThanOrEqual(2)
  })

  it('모든 CHECK 사이트의 값 목록 == TS CopayStatus (순서 무관, 중복 없음)', () => {
    for (const { file, values } of checkSites) {
      expect(new Set(values).size, `${file}: 중복 값`).toBe(values.length)
      expect(sorted(values), file).toEqual(TS_SORTED)
    }
  })

  it("컬럼 기본값은 TS 상태이며 'not_applicable'(숨김) — 트리거 전 행이 금액을 내보이지 않는다", () => {
    // CHECK 와 같은 두 경로(CREATE TABLE 인라인 + 기배포 DB 용 ALTER ADD COLUMN). 대소문자 무관으로 찾고
    // 둘 다 잡혀야 한다 — 한쪽이 다른 표기로 바뀌어 스캔에서 빠지면 조용히 초록이 되지 않게.
    const defaults = files.flatMap(({ sql }) =>
      [...sql.matchAll(/copay_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'([^']*)'/gi)].map((m) => m[1]),
    )
    expect(defaults.length).toBeGreaterThanOrEqual(2)
    for (const d of defaults) {
      expect(TS_SORTED).toContain(d)
      expect(d).toBe('not_applicable')
      expect(describeCopay(d, 240_000).show).toBe(false)
    }
  })

  it('seoul_set_copay() 트리거가 쓸 수 있는 값 == TS CopayStatus (모든 상태가 실제로 도달 가능)', () => {
    const body = files
      .map(({ sql }) => sql.match(/FUNCTION\s+public\.seoul_set_copay\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1])
      .find((b): b is string => typeof b === 'string')
    expect(body, 'seoul_set_copay() 본문을 찾지 못함').toBeDefined()
    // NEW.copay_status := 'x';  /  := CASE … THEN 'x' ELSE 'y' END;
    const assigned = new Set(
      [...body!.matchAll(/NEW\.copay_status\s*:=\s*([^;]+);/g)].flatMap((m) => quoted(m[1])),
    )
    expect(sorted(assigned)).toEqual(TS_SORTED)
  })

  const verifySql = readFileSync(VERIFY_06, 'utf8')

  it('DB 계약(verify_06_copay) C1~C6 판정이 상태마다 정확히 한 번 == TS CopayStatus (계약이 전 상태를 판정한다)', () => {
    const judged = c1to6Judged(verifySql)
    expect(judged, 'verify_06 의 C1~C6 절을 찾지 못함').toBeDefined()
    // Set 이 아니라 배열로 대조 — 한 상태를 두 번 판정하고 다른 상태를 빼먹는 경우도 빨강.
    expect(sorted(judged!)).toEqual(TS_SORTED)
  })

  it('가드 자체 검증 — C1~C6 판정에서 한 상태를 빼면 빨강 (다른 절에 같은 값이 남아 있어도)', () => {
    // 메모리 사본만 바꾼다(Plan&Source 원본은 건드리지 않음).
    const dropped = "AND a.copay_status = 'exempt_basic_livelihood'"
    expect(verifySql).toContain(dropped) // 변이 대상이 실제로 있다
    const mutant = verifySql.replace(dropped, '')
    // 파일 전체를 훑었다면 C11·C12 재확인 시나리오의 같은 값 때문에 이 변이를 놓친다 — 그 전제를 확인해 둔다.
    expect(mutant).toMatch(/copay_status\s*=\s*'exempt_basic_livelihood'/)
    const judged = c1to6Judged(mutant)
    expect(judged).toBeDefined()
    expect(judged).not.toContain('exempt_basic_livelihood')
    expect(sorted(judged!)).not.toEqual(TS_SORTED)
  })

  it('타입 전수 가드가 살아 있다 (컴파일 타임 검사의 런타임 흔적)', () => {
    expect(_ALL_LISTED).toBe(true)
  })
})
