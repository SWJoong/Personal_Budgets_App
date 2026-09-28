import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 하네스 설정 정적 계약 — `.claude/harness.json` ↔ CLAUDE.md 레인·티어 정합 (W 레인).
 *
 * 배경: PR #199 가 하네스 정본(레인·게이트·티어)을 `.claude/harness.json` 한 파일로 옮겼다. 플러그인 `harness`
 *   (>=0.3.0)의 lane-guard·pr-risk-tier·pr-merge-gate·verify-pr 가 이 파일을 그대로 읽으므로, 글롭 한 줄을 빼거나
 *   JSON 이 깨지면 곧 레인 가드·검증 티어가 무력화된다. 독립 검증(verify-pr)이 "설정을 조이는 계약이 없어 레인
 *   약화·JSON 파손 돌연변이가 게이트에서 살아남는다"고 지적 → 이 계약이 CI(quality-check `npm test`)에서 그
 *   돌연변이를 죽인다. 결정 D-20260928-01. CLAUDE.md 「검증 티어」와 harness.json `$comment` 가 이 파일을 가리킨다.
 *
 * 규칙(it 1개 = 규칙 1개, 실패 메시지가 원인을 가리킨다):
 *   1. 파싱·형태     — 유효한 JSON + 플러그인이 읽는 최상위 키의 형태.
 *   2. W 레인        — lanes.w 가 계약·검증·설계 글롭을 문자열 그대로 모두 포함(레인 약화 차단).
 *   3. 공유 파일     — lanes.shared 가 하네스 공유·인프라 파일을 모두 포함.
 *   4. 고위험 티어   — tiers.high.gate 경로군 + rls·auth·privacy·audit·money 군.
 *   5. 글롭 의미론   — lane-guard(hc_match)와 같은 매처로 대표 경로의 W 레인 소속을 판정.
 *   6. CLAUDE.md 정합 — 「레인 규칙」·「검증 티어」 요약이 정본(harness.json)과 어긋나지 않음.
 *   7. 문구·렌즈     — tiers.participantCopyGlobs · verify.lenses.
 *
 * 저작 시 돌연변이 RED 확인: ① lanes.w 에서 `src/test/**` 제거 → 2·5 RED  ② tiers.high.gate 에서 `CLAUDE.md`
 *   제거 → 4 RED  ③ 파일 끝에 `,`(JSON 파손) → 1 RED(나머지 규칙도 같은 파싱 실패 메시지로 RED).
 *
 * test-first: 저작 시점(#199 head 2cb7922)에는 규칙 6 「검증 티어」만 RED 다 — harness.json tiers.high 에
 *   storage 군이 있는데(b9aed51 에서 추가) CLAUDE.md 「검증 티어」 T2 요약에는 없다(요약 드리프트).
 *   CLAUDE.md(공유 파일 — 오케스트레이터 담당) T2 행에 storage 군을 적으면 green.
 */

const ROOT = process.cwd()
const HARNESS_JSON = '.claude/harness.json'

type Parsed = { ok: true; value: unknown } | { ok: false; error: string }

/** harness.json 을 한 번 읽는다 — 던지지 않는다(파싱 실패는 규칙 1 이 보고하고, 나머지 규칙은 같은 원인으로 실패). */
function readHarness(): Parsed {
  try {
    return { ok: true, value: JSON.parse(readFileSync(join(ROOT, HARNESS_JSON), 'utf8')) as unknown }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
const harness = readHarness()

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/** 점 경로(`lanes.w`)로 설정 값을 꺼낸다. 중간이 객체가 아니면 undefined. 파싱 실패면 원인과 함께 던진다. */
function pick(path: string): unknown {
  if (!harness.ok) throw new Error(`${HARNESS_JSON} 을 파싱할 수 없어 이 규칙을 판정할 수 없음 — ${harness.error}`)
  let cur: unknown = harness.value
  for (const key of path.split('.')) {
    if (!isRecord(cur)) return undefined
    cur = cur[key]
  }
  return cur
}

/** 문자열 배열 설정 값 — 형태가 다르면 경로·실제 값과 함께 실패. */
function strings(path: string): string[] {
  const v = pick(path)
  if (!isStringArray(v)) throw new Error(`${HARNESS_JSON} ${path} 가 문자열 배열이 아님(실제: ${JSON.stringify(v)})`)
  return v
}

/** required 중 actual 에 문자열 그대로 없는 것. */
function missingFrom(actual: readonly string[], required: readonly string[]): string[] {
  return required.filter((r) => !actual.includes(r))
}

// ── 계약 값 ────────────────────────────────────────────────────────────────────────────────
/** 2. W 레인(계약·검증·설계) 필수 글롭 — 하나라도 빠지면 구현 워커가 그 경로를 편집할 수 있게 된다. */
const REQUIRED_W_LANE: readonly string[] = [
  'Plan&Source/**',
  '**/verify_*.sql',
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'src/**/*.spec.ts',
  'src/**/*.spec.tsx',
  'src/test/**',
  'vitest.config.ts',
  '.claude/skills/**',
  'docs/harness-plan.md',
]

/** 3. 공유·인프라 필수 항목 — 양쪽 워커 모두 편집 차단(오케스트레이터·사람 담당). */
const REQUIRED_SHARED: readonly string[] = [
  'CLAUDE.md',
  '.claude/harness.json',
  '.claude/settings.json',
  '.github/pull_request_template.md',
  'scripts/agent-sync.sh',
  'docs/release/decisions.md',
  'docs/release/qa-runs/**',
  '.claude/agents/**',
  '.claude/workflows/**',
]

/** 4. gate 경로군 — CI·하네스 설정·규칙 문서를 바꾸는 PR 은 고위험(T2) 팬아웃 검증을 받아야 한다. */
const REQUIRED_GATE: readonly string[] = [
  '.github/workflows/**',
  '.claude/settings.json',
  '.claude/harness.json',
  'CLAUDE.md',
  '.claude/skills/**',
  'docs/harness-plan.md',
  '.github/pull_request_template.md',
  'scripts/agent-sync.sh',
]

/** 4. 반드시 있어야 하는 고위험 군(빈 배열이면 없는 것과 같다 — 그 경로 PR 이 T2 로 오르지 않는다). */
const REQUIRED_HIGH_GROUPS: readonly string[] = ['rls', 'auth', 'privacy', 'audit', 'money']

/** 5. W 레인에 들어야 하는 대표 경로(계약·검증·설계). 루트 0-깊이(`src/x.test.ts`·`verify_root.sql`) 포함. */
const W_LANE_SAMPLES: readonly string[] = [
  'src/test/setup.ts',
  'src/utils/copay.test.ts',
  'src/x.test.ts',
  'src/app/actions/foo.spec.tsx',
  'Plan&Source/ontology/seoul/verify_01_behaviour.sql',
  'verify_root.sql',
  '.claude/skills/qa/SKILL.md',
  'docs/harness-plan.md',
  'vitest.config.ts',
]

/** 5. W 레인에 들면 안 되는 대표 경로(U 레인 — 구현 코드·빌드 SQL·빌드 설정). */
const U_LANE_SAMPLES: readonly string[] = [
  'src/utils/copay.ts',
  'supabase/seoul/21_new.sql',
  'src/app/actions/receipts.ts',
  'next.config.ts',
]

/** 6. CLAUDE.md 는 test/spec 4글롭을 brace 축약 1개로 적는다 — 이 축약은 정확히 아래 4글롭을 대신한다. */
const TEST_SPEC_SHORTHAND = 'src/**/*.{test,spec}.{ts,tsx}'
const TEST_SPEC_PATTERNS: readonly string[] = [
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'src/**/*.spec.ts',
  'src/**/*.spec.tsx',
]

/** 7. 당사자 문구 글롭 필수 항목 · 필수 검증 렌즈. */
const REQUIRED_PARTICIPANT_COPY: readonly string[] = ['src/app/(participant)/**', 'src/utils/easyTerms.ts']
const REQUIRED_LENSES: readonly string[] = ['a11y-copy', 'tests-mutation']

// ── 5. 글롭 매처 ─────────────────────────────────────────────────────────────────────────────
// 플러그인 harness(>=0.3.0) scripts/harness-config.sh 의 hc_match 와 같은 의미론(bash `case "$rel" in $p)`):
//   · `*`(따라서 `**`)는 `/` 를 포함한 임의 문자열(빈 문자열 포함), `?` 는 임의의 한 글자, 나머지 문자는 그대로.
//   · 패턴에 `**/` 가 있으면 그것을 전부 뗀 형태도 시도한다(= 0개 디렉터리: `src/**/*.test.ts` 가 `src/x.test.ts` 도,
//     `**/verify_*.sql` 이 루트의 `verify_x.sql` 도 잡는다).
//   · 미지원: 셸 문자집합 `[...]` — 여기서는 문자 그대로 취급한다(bash 는 한 글자 집합). 현재 설정 글롭엔 `[` 가 없다.
// 저작 시 이 매처를 실제 hc_match(bash)와 차분 비교했다(설정의 모든 글롭 × 대표·경계 경로 4263쌍, 불일치 0).
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function globToRegExp(glob: string): RegExp {
  let src = ''
  for (const ch of glob) {
    src += ch === '*' ? '.*' : ch === '?' ? '.' : escapeRegExp(ch)
  }
  return new RegExp(`^${src}$`, 'u')
}

/** rel(저장소 상대경로)이 globs 중 하나에 걸리는가 — hc_match 와 동일. */
function inLane(rel: string, globs: readonly string[]): boolean {
  return globs.some((p) => {
    if (!p) return false
    if (globToRegExp(p).test(rel)) return true
    const zeroDir = p.split('**/').join('')
    return zeroDir !== p && globToRegExp(zeroDir).test(rel)
  })
}

// ── 6. CLAUDE.md 절 읽기 ─────────────────────────────────────────────────────────────────────
/** CLAUDE.md 의 `### <제목>` 줄부터 다음 같은·상위 수준 제목(`#`~`###`) 전까지. */
function claudeSection(title: string): string {
  const lines = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8').split(/\r?\n/)
  const start = lines.findIndex((l) => l.startsWith(`### ${title}`))
  if (start < 0) {
    throw new Error(`CLAUDE.md 에 「### ${title}」 절이 없음 — 제목을 바꿨으면 이 계약의 절 이름도 함께 고친다`)
  }
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^#{1,3} /.test(l))
  return [lines[start], ...(end < 0 ? rest : rest.slice(0, end))].join('\n')
}

/** 텍스트 안의 인라인 코드(백틱 한 쌍) 조각들. */
function codeSpans(text: string): Set<string> {
  return new Set(Array.from(text.matchAll(/`([^`\n]+)`/g), (m) => m[1]))
}

/**
 * 군 이름이 절에 적혀 있는가 — 백틱 밖 본문의 독립 낱말(영숫자·밑줄에 붙지 않음)이거나, 이름 그대로인 백틱 조각.
 * 경로 조각은 세지 않는다: 백틱 안 `ai.ts` 의 ai·`12_audit_log` 의 audit·`*rls*.sql` 의 rls 는 군 이름 표기가 아니다.
 */
function mentionsGroup(section: string, name: string): boolean {
  if (codeSpans(section).has(name)) return true
  const prose = section.replace(/`[^`\n]+`/g, ' ')
  return new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(name)}([^A-Za-z0-9_]|$)`).test(prose)
}

describe('하네스 설정 정적 계약 — .claude/harness.json ↔ CLAUDE.md', () => {
  describe('1. 파싱·형태', () => {
    it('.claude/harness.json 이 유효한 JSON 이다(깨지면 lane-guard 가 워커 편집을 막고 티어 판정이 멈춘다)', () => {
      expect(harness.ok ? null : harness.error, `${HARNESS_JSON} JSON 파싱 실패`).toBeNull()
    })

    it('플러그인이 읽는 최상위 키가 올바른 형태로 있다', () => {
      const isNonEmptyString = (v: unknown) => typeof v === 'string' && v.length > 0
      const isPositiveInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0
      const shape: Array<[path: string, ok: (v: unknown) => boolean, want: string]> = [
        ['lanes.w', (v) => isStringArray(v) && v.length > 0, '비어 있지 않은 문자열 배열'],
        ['lanes.shared', isStringArray, '문자열 배열'],
        ['tiers.high', isRecord, '객체'],
        ['tiers.large.files', isPositiveInt, '양의 정수'],
        ['tiers.large.lines', isPositiveInt, '양의 정수'],
        ['verify.lenses', isStringArray, '문자열 배열'],
        ['channel.seatPrefixes', isStringArray, '문자열 배열'],
        ['prefixes.toVerifier', isNonEmptyString, '비어 있지 않은 문자열'],
        ['prefixes.toAuthor', isNonEmptyString, '비어 있지 않은 문자열'],
        ['baseBranch', isNonEmptyString, '비어 있지 않은 문자열'],
      ]
      const bad = shape
        .filter(([path, ok]) => !ok(pick(path)))
        .map(([path, , want]) => `${path} — 기대: ${want}, 실제: ${JSON.stringify(pick(path))}`)
      expect(bad, `${HARNESS_JSON} 형태 위반 — 플러그인 스크립트가 이 키를 읽는다`).toEqual([])
    })
  })

  describe('2. W 레인 필수 글롭', () => {
    it('lanes.w 가 계약·검증·설계 글롭을 문자열 그대로 모두 포함한다', () => {
      expect(
        missingFrom(strings('lanes.w'), REQUIRED_W_LANE),
        'lanes.w 에서 빠진 W 레인 글롭 — 레인 약화: 구현 워커가 이 경로(계약·검증·설계)를 편집할 수 있게 된다',
      ).toEqual([])
    })
  })

  describe('3. 공유 파일 필수 항목', () => {
    it('lanes.shared 가 하네스 공유·인프라 파일을 모두 포함한다', () => {
      expect(
        missingFrom(strings('lanes.shared'), REQUIRED_SHARED),
        'lanes.shared 에서 빠진 공유 파일 — 워커가 하네스 규칙·설정·기록을 편집할 수 있게 된다',
      ).toEqual([])
    })
  })

  describe('4. 고위험 티어', () => {
    it('tiers.high.gate 가 CI·하네스 설정·규칙 문서 경로를 모두 포함한다', () => {
      expect(
        missingFrom(strings('tiers.high.gate'), REQUIRED_GATE),
        'tiers.high.gate 에서 빠진 경로 — 그 파일을 바꾸는 PR 이 고위험(T2) 팬아웃 검증 없이 낮은 티어로 내려간다',
      ).toEqual([])
    })

    it('tiers.high 에 rls·auth·privacy·audit·money 군이 비어 있지 않은 글롭 배열로 있다', () => {
      const high = pick('tiers.high')
      const absent = REQUIRED_HIGH_GROUPS.filter((group) => {
        const globs = isRecord(high) ? high[group] : undefined
        return !(isStringArray(globs) && globs.length > 0)
      })
      expect(absent, 'tiers.high 에 없거나 비어 있는 고위험 군 — 그 경로를 바꾸는 PR 이 T2 로 오르지 않는다').toEqual([])
    })
  })

  describe('5. 글롭 의미론 (lane-guard hc_match 와 동일)', () => {
    it('매처 자기검증 — `*` 는 `/` 를 넘고, `**/` 는 0개 디렉터리도, `?` 는 한 글자, 나머지는 문자 그대로', () => {
      const cases: Array<[glob: string, rel: string, expected: boolean]> = [
        ['src/*.ts', 'src/a/b/c.ts', true], // `*` 가 `/` 를 가로지른다(case 의미론)
        ['src/**/*.test.ts', 'src/x.test.ts', true], // `**/` = 0개 디렉터리
        ['**/verify_*.sql', 'verify_root.sql', true],
        ['a?', 'ab', true],
        ['a?', 'abc', false], // `?` 는 정확히 한 글자
        ['Plan&Source/**', 'PlanXSource/x', false], // `&` 는 문자 그대로
        ['vitest.config.ts', 'vitestXconfig.ts', false], // `.` 는 문자 그대로(정규식 메타 아님)
        ['vitest.config.ts', 'x/vitest.config.ts', false], // 전체 일치(부분 일치 아님)
        ['src/app/(participant)/**', 'src/app/(participant)/page.tsx', true], // 괄호는 문자 그대로
        ['src/test/**', 'src/test', false], // 디렉터리 글롭은 그 아래 경로만
      ]
      const wrong = cases
        .filter(([glob, rel, expected]) => inLane(rel, [glob]) !== expected)
        .map(([glob, rel, expected]) => `${glob} ~ ${rel} (기대 ${expected})`)
      expect(wrong, '계약 매처가 lane-guard(hc_match) 의미론과 다름 — 매처(체커) 자체 버그').toEqual([])
    })

    it('W 레인 대표 경로(계약·검증·설계)는 lanes.w 에 든다', () => {
      const lanesW = strings('lanes.w')
      expect(
        W_LANE_SAMPLES.filter((rel) => !inLane(rel, lanesW)),
        'lanes.w 글롭에 안 걸리는 W 레인 경로 — lane-guard 가 구현 워커의 이 파일 편집을 막지 못한다(레인 약화)',
      ).toEqual([])
    })

    it('U 레인 대표 경로(구현 코드·빌드 SQL·빌드 설정)는 lanes.w 에 들지 않는다', () => {
      const lanesW = strings('lanes.w')
      expect(
        U_LANE_SAMPLES.filter((rel) => inLane(rel, lanesW)),
        'lanes.w 글롭에 걸리는 구현 경로 — 구현 워커가 자기 레인을 편집 못 하고 계약 저자가 구현을 쓸 수 있게 된다(레인 과확장)',
      ).toEqual([])
    })
  })

  describe('6. CLAUDE.md 정합', () => {
    it('「레인 규칙」 절이 lanes.w 의 모든 글롭을 백틱 그대로 적는다(test/spec 4글롭은 brace 축약 1개로 대체 인정)', () => {
      const spans = codeSpans(claudeSection('레인 규칙'))
      const documented = (glob: string) =>
        spans.has(glob) || (TEST_SPEC_PATTERNS.includes(glob) && spans.has(TEST_SPEC_SHORTHAND))
      expect(
        strings('lanes.w').filter((glob) => !documented(glob)),
        'CLAUDE.md 「레인 규칙」 요약에 없는 W 레인 글롭 — 정본(harness.json)과 요약이 어긋난다',
      ).toEqual([])
    })

    it('「검증 티어」 절이 tiers.high 의 모든 군 이름을 적는다', () => {
      const section = claudeSection('검증 티어')
      const high = pick('tiers.high')
      if (!isRecord(high)) throw new Error(`${HARNESS_JSON} tiers.high 가 객체가 아님(실제: ${JSON.stringify(high)})`)
      expect(
        Object.keys(high).filter((group) => !mentionsGroup(section, group)),
        'CLAUDE.md 「검증 티어」 T2 요약에 없는 고위험 군 — 정본(harness.json tiers.high)과 요약이 어긋난다',
      ).toEqual([])
    })
  })

  describe('7. 당사자 문구 글롭·검증 렌즈', () => {
    it('tiers.participantCopyGlobs 가 당사자 화면과 쉬운 용어 사전을 포함한다', () => {
      expect(
        missingFrom(strings('tiers.participantCopyGlobs'), REQUIRED_PARTICIPANT_COPY),
        'tiers.participantCopyGlobs 에서 빠진 글롭 — 당사자 문구 변경이 접근성·문구 검증 없이 지나간다',
      ).toEqual([])
    })

    it('verify.lenses 가 a11y-copy(접근성·문구)와 tests-mutation(테스트·돌연변이) 렌즈를 포함한다', () => {
      expect(
        missingFrom(strings('verify.lenses'), REQUIRED_LENSES),
        'verify.lenses 에서 빠진 렌즈 — /harness:verify-pr 가 그 관점을 검증하지 않는다',
      ).toEqual([])
    })
  })
})
