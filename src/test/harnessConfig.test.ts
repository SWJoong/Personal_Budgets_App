import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 하네스 설정 정적 계약 — `.claude/harness.json` ↔ CLAUDE.md 레인·티어·채널 정합 (W 레인).
 *
 * 배경: PR #199 가 하네스 정본(레인·게이트·티어)을 `.claude/harness.json` 한 파일로 옮겼다. 플러그인 `harness`
 *   (>=0.3.0)의 lane-guard·pr-risk-tier·pr-merge-gate·agent-sync·verify-pr 가 이 파일을 그대로 읽으므로, 글롭 한 줄을
 *   빼거나 JSON 이 깨지면 곧 레인 가드·검증 티어·사람 자리 접두 가드가 무력화된다. 독립 검증(verify-pr)이 "설정을
 *   조이는 계약이 없어 레인 약화·JSON 파손 돌연변이가 게이트에서 살아남는다"고 지적 → 이 계약이 CI(quality-check
 *   `npm test`)에서 그 돌연변이를 죽인다. 결정 D-20260928-01. CLAUDE.md 「검증 티어」와 harness.json `$comment` 가
 *   이 파일을 가리킨다. src 를 바꾸지 않는 설정 PR 은 돌연변이 검증 대신 이 계약으로 조인다(CLAUDE.md 「검증 티어」).
 *
 * 원칙: 필수 목록은 "저작 시점 harness.json 값 = 최소 집합"이다(늘리는 것은 자유, 줄이면 RED). 줄여야 할 이유가
 *   생기면 설정과 이 계약을 같은 PR(gate 티어 — 팬아웃 검증 + 사람 승인)에서 함께 고친다.
 *
 * 규칙(it 1개 = 규칙 1개, 실패 메시지가 원인을 가리킨다):
 *   1. 파싱·형태     — 유효한 JSON + 플러그인이 읽는 최상위 키의 형태.
 *   2. W 레인        — lanes.w 가 계약·검증·설계 글롭을 문자열 그대로 모두 포함(레인 약화 차단).
 *   3. 공유 파일     — lanes.shared 가 공유·인프라 목록 전체를 포함 + U·W 레인 경로를 삼키지 않음(과확장 차단).
 *   4. 고위험 티어   — gate 목록 전체 · 7군 존재 · 군별 필수 글롭 · 군별 대표 경로(권한 경계 호출부 12개 포함) ·
 *                      sqlPolicyRegex 샘플 매치 · docs 가 코드를 잡지 않음 · large 상한.
 *   5. 글롭 의미론   — lane-guard(hc_match)와 같은 매처로 대표 경로의 W 레인 소속을 판정.
 *   6. CLAUDE.md 정합 — 양방향: 「레인 규칙」 W·공유 ↔ lanes.w·lanes.shared, 「검증 티어」 T2 군 ↔ tiers.high,
 *                      T1 임계 = tiers.large.
 *   7. 문구·렌즈·스킬 — participantCopyGlobs 4 · verify.lenses 5 · roleSkills.w · CLAUDE.md 접근성 검증 체크 수치.
 *   8. 채널          — channel.seatPrefixes 3접두 · channel.branch · roles.seat.
 *   9. 게이트 명령   — gate.all 4단계(&& 만) · gate.contract `vitest run {file}`.
 *
 * 저작 시 돌연변이 RED 확인(#199 head b5d9109 위, 매번 `git checkout -- .claude/harness.json CLAUDE.md` 로 원복):
 *   1차 저작(2cb7922) — ① lanes.w 에서 `src/test/**` 제거 → 2·5 RED  ② tiers.high.gate 에서 `CLAUDE.md` 제거 → 4 RED
 *     ③ 파일 끝에 `,`(JSON 파손) → 1 RED(나머지 규칙도 같은 파싱 실패 메시지로 RED).
 *   2차 보강(verify-pr #199 재검증 fbd70a8 생존 돌연변이 전부) — storage 군 삭제·rls/auth/privacy/money/audit 글롭 제거·
 *     군 전부 `["x"]`·gate 에서 agents/workflows/commands/.mcp.json 제거·sqlPolicyRegex 삭제/`$^`/`^$NEVER`·
 *     participantCopyGlobs 에서 components/content 제거·large 9999·seatPrefixes `[]`·channel.branch `main`·
 *     tiers.docs `["**"]`/`+src/**`·lanes.shared 에서 AGENTS.md/.mcp.json/settings.local.json/commands 제거·
 *     lanes.shared `+src/**`·gate.all/contract `"true"`·lenses 에서 security-rls/requirements-types 제거·
 *     roleSkills.w 에서 easy-read-review 제거·CLAUDE.md 접근성 검증 체크 줄 삭제 → 각각 해당 규칙 RED.
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

/** 문자열 설정 값 — 형태가 다르면 경로·실제 값과 함께 실패. */
function text(path: string): string {
  const v = pick(path)
  if (typeof v !== 'string') throw new Error(`${HARNESS_JSON} ${path} 가 문자열이 아님(실제: ${JSON.stringify(v)})`)
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

/** 3. 공유·인프라 필수 항목(저작 시점 lanes.shared 전체) — 양쪽 워커 모두 편집 차단(오케스트레이터·사람 담당). */
const REQUIRED_SHARED: readonly string[] = [
  'CLAUDE.md',
  'AGENTS.md',
  '.mcp.json',
  '.claude/harness.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.claude/agents/**',
  '.claude/workflows/**',
  '.claude/commands/**',
  '.claude/agent-memory/**',
  '.github/pull_request_template.md',
  'scripts/agent-sync.sh',
  'docs/release/decisions.md',
  'docs/release/qa-runs/**',
]

/** 4. gate 경로군(저작 시점 tiers.high.gate 전체) — CI·하네스 설정·규칙 문서를 바꾸는 PR 은 T2 팬아웃 검증. */
const REQUIRED_GATE: readonly string[] = [
  '.github/workflows/**',
  '.github/pull_request_template.md',
  '.claude/settings.json',
  '.claude/harness.json',
  '.claude/agents/**',
  '.claude/workflows/**',
  '.claude/commands/**',
  '.claude/skills/**',
  '.claude/agent-memory/**',
  '.mcp.json',
  'CLAUDE.md',
  'docs/harness-plan.md',
  'scripts/agent-sync.sh',
]

/**
 * 4. 고위험 군별 필수 글롭(저작 시점 tiers.high 값 = 최소 집합). 한 줄이라도 빠지면 그 경로 PR 이 T1(단건 검증)로
 *    내려간다 — 설치본 pr-risk-tier.sh 로 확인: auth 에서 `src/utils/supabase/**` 를 빼면 server.ts 가 high → small.
 */
const REQUIRED_HIGH: Readonly<Record<string, readonly string[]>> = {
  rls: [
    'supabase/**/*rls*.sql',
    'supabase/seoul/01_core.sql',
    'supabase/seoul/03_seoul_schema.sql',
    'supabase/seoul/06_storage.sql',
    'supabase/seoul/12_audit_log.sql',
  ],
  auth: [
    'src/proxy.ts',
    'src/app/(auth)/**',
    'src/app/api/**',
    'src/app/actions/demoAuth.ts',
    'src/app/actions/viewAs.ts',
    'src/app/actions/admin.ts',
    'src/utils/supabase/**',
    'src/utils/viewAsCookies.ts',
    'src/utils/superAdmin.ts',
    'src/app/actions/preferences.ts',
    'src/app/actions/profile.ts',
    'src/app/actions/appeal.ts',
    'src/app/actions/serviceProvider.ts',
    'src/app/actions/planReview.ts',
    'src/app/actions/feedback.ts',
  ],
  privacy: [
    'src/utils/deidentify.ts',
    'src/utils/aiDeidentify.ts',
    'src/utils/ai.ts',
    'src/utils/easyReadSummary.ts',
    'src/utils/activitySuggestion.ts',
    'src/utils/staffReviewSuggestion.ts',
    'src/app/actions/ocr.ts',
    'src/app/actions/easyReadSummary.ts',
    'src/app/actions/activitySuggestion.ts',
    'src/app/actions/staffReviewSuggestion.ts',
    'src/content/privacyPolicy.ts',
    'src/app/privacy/**',
  ],
  audit: [
    'src/utils/audit*.ts',
    'src/utils/supervision.ts',
    'src/app/(supporter)/admin/audit/**',
    'src/app/(supporter)/admin/participants/*/preview/**',
    'src/app/actions/evaluation.ts',
    'src/app/actions/planReview.ts',
  ],
  money: [
    'src/app/actions/settlement.ts',
    'src/app/actions/serviceUsage.ts',
    'src/app/actions/ruleCheck.ts',
    'src/app/api/export/**',
    'src/utils/settlement*.ts',
    'src/utils/orgLedger.ts',
    'src/utils/ledgerCsv.ts',
    'src/utils/copay.ts',
    'src/utils/budgetByDomain.ts',
    'src/app/(supporter)/supporter/settlements/**',
    'src/app/(supporter)/supporter/transactions/**',
  ],
  storage: [
    'src/app/actions/activityPhoto.ts',
    'src/app/actions/document.ts',
    'src/app/actions/application.ts',
    'src/utils/supabase/storage.ts',
    'src/app/(participant)/gallery/**',
    'src/app/(supporter)/supporter/*/gallery/**',
  ],
  gate: REQUIRED_GATE,
}

/** 4. 반드시 있어야 하는 고위험 군(빈 배열이면 없는 것과 같다 — 그 경로 PR 이 T2 로 오르지 않는다). */
const REQUIRED_HIGH_GROUPS: readonly string[] = Object.keys(REQUIRED_HIGH)

/**
 * 4. 군별 대표 경로(rls~storage 는 실제 저장소 파일, gate 일부는 경로 예시) — 그 군의 글롭에 걸려야 한다(파일 존재는
 *    요구하지 않는다). 권한 경계 호출부 12개(#199 재검증 반영)를 고정한다:
 *    view-as 쓰기 차단 액션(preferences·profile·appeal·serviceProvider·planReview)·admin 클라 조회(feedback) → auth,
 *    감사 기록(evaluation·planReview·supervision·preview) → audit, admin 클라 storage(application·두 갤러리) → storage.
 */
const HIGH_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  rls: [
    'supabase/seoul/02_core_rls.sql',
    'supabase/seoul/04_seoul_rls.sql',
    'supabase/seoul/01_core.sql',
    'supabase/seoul/03_seoul_schema.sql',
    'supabase/seoul/06_storage.sql',
    'supabase/seoul/12_audit_log.sql',
  ],
  auth: [
    'src/proxy.ts',
    'src/app/(auth)/login/page.tsx',
    'src/app/(auth)/auth/callback/route.ts',
    'src/app/api/supporters/route.ts',
    'src/app/actions/demoAuth.ts',
    'src/app/actions/viewAs.ts',
    'src/app/actions/admin.ts',
    'src/utils/supabase/server.ts',
    'src/utils/supabase/viewAs.ts',
    'src/utils/viewAsCookies.ts',
    'src/utils/superAdmin.ts',
    'src/app/actions/preferences.ts',
    'src/app/actions/profile.ts',
    'src/app/actions/appeal.ts',
    'src/app/actions/serviceProvider.ts',
    'src/app/actions/planReview.ts',
    'src/app/actions/feedback.ts',
  ],
  privacy: [
    'src/utils/deidentify.ts',
    'src/utils/aiDeidentify.ts',
    'src/utils/ai.ts',
    'src/utils/easyReadSummary.ts',
    'src/utils/activitySuggestion.ts',
    'src/utils/staffReviewSuggestion.ts',
    'src/app/actions/ocr.ts',
    'src/app/actions/easyReadSummary.ts',
    'src/app/actions/activitySuggestion.ts',
    'src/app/actions/staffReviewSuggestion.ts',
    'src/content/privacyPolicy.ts',
    'src/app/privacy/page.tsx',
    'src/app/privacy/easy/page.tsx',
  ],
  audit: [
    'src/utils/audit.ts',
    'src/utils/auditLabels.ts',
    'src/utils/supervision.ts',
    'src/app/(supporter)/admin/audit/page.tsx',
    'src/app/(supporter)/admin/participants/[id]/preview/page.tsx',
    'src/app/actions/evaluation.ts',
    'src/app/actions/planReview.ts',
  ],
  money: [
    'src/app/actions/settlement.ts',
    'src/app/actions/serviceUsage.ts',
    'src/app/actions/ruleCheck.ts',
    'src/app/api/export/transactions/route.ts',
    'src/utils/settlementLedger.ts',
    'src/utils/settlementStatus.ts',
    'src/utils/orgLedger.ts',
    'src/utils/ledgerCsv.ts',
    'src/utils/copay.ts',
    'src/utils/budgetByDomain.ts',
    'src/app/(supporter)/supporter/settlements/page.tsx',
    'src/app/(supporter)/supporter/transactions/[id]/page.tsx',
  ],
  storage: [
    'src/app/actions/activityPhoto.ts',
    'src/app/actions/document.ts',
    'src/app/actions/application.ts',
    'src/utils/supabase/storage.ts',
    'src/app/(participant)/gallery/page.tsx',
    'src/app/(supporter)/supporter/[participantId]/gallery/page.tsx',
  ],
  gate: [
    '.github/workflows/ci.yml',
    '.github/workflows/db-verify.yml',
    '.github/pull_request_template.md',
    '.claude/settings.json',
    '.claude/harness.json',
    '.claude/agents/u-worker.md',
    '.claude/workflows/verify-pr.js',
    '.claude/commands/migration.md',
    '.claude/skills/qa/SKILL.md',
    '.claude/agent-memory/harness-w-verifier/MEMORY.md',
    '.mcp.json',
    'CLAUDE.md',
    'docs/harness-plan.md',
    'scripts/agent-sync.sh',
  ],
}

/**
 * 4. sqlPolicyRegex 가 잡아야 하는 SQL diff 줄 — 정규식의 대안(alternative)마다 그것만 걸리는 줄 1개 이상.
 *    함수·트리거 본문 한 줄만 바뀌는 diff(CREATE 줄은 문맥이라 +/- 가 아님)도 잡도록 술어·경로검사 함수 호출 줄을 둔다.
 */
const SQL_POLICY_SAMPLES: readonly string[] = [
  'CREATE POLICY seoul_tx_select ON public.seoul_transactions',
  'ALTER POLICY seoul_tx_select ON public.seoul_transactions TO authenticated',
  'DROP POLICY IF EXISTS seoul_tx_select ON public.seoul_transactions;',
  'LANGUAGE sql STABLE SECURITY DEFINER',
  'GRANT EXECUTE ON FUNCTION public.seoul_audit_purge() TO service_role;',
  'REVOKE ALL ON FUNCTION public.seoul_audit_purge() FROM PUBLIC;',
  'ALTER TABLE public.seoul_transactions ENABLE ROW LEVEL SECURITY;',
  'CREATE OR REPLACE FUNCTION seoul_can_access(p_participant uuid)',
  'CREATE FUNCTION public.seoul_touch_updated_at() RETURNS trigger',
  'CREATE TRIGGER trg_activity_photo_path BEFORE INSERT ON public.seoul_activity_photos',
  'CREATE OR REPLACE TRIGGER trg_activity_photo_path BEFORE UPDATE ON public.seoul_activity_photos',
  '  USING (seoul_is_staff_for(participant_id))',
  '  SELECT seoul_is_admin()',
  '  OR seoul_is_self(p_participant)',
  '  EXECUTE FUNCTION seoul_check_photo_path();',
]

/** 4. tiers.docs 에 걸리면 안 되는 코드·빌드·스크립트 경로(걸리면 그 PR 이 VERIFY REPORT 없는 T0 가 된다). */
const DOCS_EXCLUDED_SAMPLES: readonly string[] = [
  'src/app/actions/receipts.ts',
  'src/utils/copay.ts',
  'src/app/(participant)/page.tsx',
  'src/components/ui/Button.tsx',
  'supabase/seoul/21_new.sql',
  'scripts/x.sh',
  'next.config.ts',
  'package.json',
  '.github/workflows/ci.yml',
]

/** 4. tiers.large 상한 — CLAUDE.md 「검증 티어」 T1 행(코드 ≤ 12파일·≤ 400줄)과 같은 값. 올리면 대형 PR 이 팬아웃을 건너뛴다. */
const LARGE_MAX = { files: 12, lines: 400 } as const

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

/** 5. W 레인에 들면 안 되는 대표 경로(U 레인 — 구현 코드·빌드 SQL·빌드 설정). 3 에서 lanes.shared 에도 대조한다. */
const U_LANE_SAMPLES: readonly string[] = [
  'src/utils/copay.ts',
  'supabase/seoul/21_new.sql',
  'src/app/actions/receipts.ts',
  'next.config.ts',
]

/**
 * 6. CLAUDE.md 약식 표기 — 백틱 조각 하나가 정확히 아래 글롭들을 대신한다(그 밖의 약식은 인정하지 않는다).
 *    `.claude/settings*.json` 을 글롭으로 읽으면 settings.x.json 도 걸리지만, 여기서는 나열된 두 파일만 뜻한다.
 */
const SHORTHANDS: ReadonlyMap<string, readonly string[]> = new Map([
  ['src/**/*.{test,spec}.{ts,tsx}', ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx']],
  ['.claude/settings*.json', ['.claude/settings.json', '.claude/settings.local.json']],
  ['.claude/agents|workflows|commands/**', ['.claude/agents/**', '.claude/workflows/**', '.claude/commands/**']],
])

/** 7. 당사자 문구 글롭(저작 시점 전체) · 검증 렌즈(5렌즈 전부) · 검증자 역할 스킬. */
const REQUIRED_PARTICIPANT_COPY: readonly string[] = [
  'src/app/(participant)/**',
  'src/components/**',
  'src/utils/easyTerms.ts',
  'src/content/**',
]
const REQUIRED_LENSES: readonly string[] = [
  'requirements-types',
  'security-rls',
  'a11y-copy',
  'tests-mutation',
  'docs-consistency',
]
const REQUIRED_W_SKILLS: readonly string[] = ['qa', 'pl', 'easy-read-review']

/** 7. CLAUDE.md 「접근성 원칙」 검증 체크 줄의 수치 기준 — 플러그인 a11y-copy 렌즈에는 수치가 없어 이 줄이 기준이다. */
const A11Y_CHECK_TOKENS: readonly string[] = ['4.5:1', '44px', 'jsx-a11y', '≥ 70', '3:1']

/** 8. 사람 자리 기록 접두(CLAUDE.md 「상태 동기화」) — 비면 agent-sync 가 w.md 접두 가드를 끈다(agent-sync.sh:86). */
const REQUIRED_SEAT_PREFIXES: readonly string[] = ['[DECISION by user]', '[QA by user]', '[MERGED by user]']

/** 9. 전체 게이트 단계(CLAUDE.md 「매 세션 루틴」 게이트 줄) · 계약 단건 게이트의 필수 조각. */
const REQUIRED_GATE_ALL_STEPS: readonly string[] = ['tsc --noEmit', 'npm run lint', 'npm test', 'npm run build']
const REQUIRED_GATE_CONTRACT_PARTS: readonly string[] = ['vitest run', '{file}']

// ── 5. 글롭 매처 ─────────────────────────────────────────────────────────────────────────────
// 플러그인 harness(>=0.3.0) scripts/harness-config.sh 의 hc_match 와 같은 의미론(bash `case "$rel" in $p)`):
//   · `*`(따라서 `**`)는 `/` 를 포함한 임의 문자열(빈 문자열 포함), `?` 는 임의의 한 글자, 나머지 문자는 그대로.
//   · 패턴에 `**/` 가 있으면 그것을 전부 뗀 형태도 시도한다(= 0개 디렉터리: `src/**/*.test.ts` 가 `src/x.test.ts` 도,
//     `**/verify_*.sql` 이 루트의 `verify_x.sql` 도 잡는다).
//   · 미지원: 셸 문자집합 `[...]` — 여기서는 문자 그대로 취급한다(bash 는 한 글자 집합). 현재 설정 글롭엔 `[` 가 없다
//     (경로 쪽 `[id]`·`[participantId]` 는 문자 그대로이고 글롭 `*` 가 잡는다).
// 저작 시 이 매처를 실제 hc_match(bash)와 차분 비교했다(설정의 모든 글롭 × 대표·경계 경로, 불일치 0).
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

/** tiers.high.<group> 글롭 — 없거나 문자열 배열이 아니면 빈 배열(그러면 샘플이 전부 안 걸려 원인이 드러난다). */
function highGlobs(group: string): string[] {
  const v = pick(`tiers.high.${group}`)
  return isStringArray(v) ? v : []
}

// ── 6·7. CLAUDE.md 절 읽기 ───────────────────────────────────────────────────────────────────
/** CLAUDE.md 의 `heading`(예: `### 레인 규칙`·`## 접근성 원칙`) 줄부터 다음 같은·상위 수준 제목 전까지. */
function claudeSection(heading: string): string {
  const level = /^#+/.exec(heading)?.[0].length ?? 0
  if (level === 0) throw new Error(`계약 버그: 절 제목 「${heading}」 에 # 수준이 없음`)
  const lines = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8').split(/\r?\n/)
  const start = lines.findIndex((l) => l.startsWith(`${heading}`))
  if (start < 0) {
    throw new Error(`CLAUDE.md 에 「${heading}」 절이 없음 — 제목을 바꿨으면 이 계약의 절 이름도 함께 고친다`)
  }
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => new RegExp(`^#{1,${level}} `).test(l))
  return [lines[start], ...(end < 0 ? rest : rest.slice(0, end))].join('\n')
}

/** 절 안에서 `prefix` 로 시작하는 첫 줄 — 없으면 형식이 바뀐 것이므로 원인과 함께 실패. */
function sectionLine(section: string, prefix: string): string {
  const line = section.split('\n').find((l) => l.startsWith(prefix))
  if (line === undefined) {
    const title = section.split('\n')[0]
    throw new Error(`CLAUDE.md 「${title}」 에 「${prefix}」 로 시작하는 줄이 없음 — 형식을 바꿨으면 이 계약도 함께 고친다`)
  }
  return line
}

/** 텍스트 안의 인라인 코드(백틱 한 쌍) 조각들. */
function codeSpans(text: string): Set<string> {
  return new Set(Array.from(text.matchAll(/`([^`\n]+)`/g), (m) => m[1]))
}

/** 백틱 조각을 글롭 목록으로 — 약식 표기면 그것이 대신하는 글롭들, 아니면 조각 그대로. */
function expandSpan(span: string): readonly string[] {
  return SHORTHANDS.get(span) ?? [span]
}

/** glob 이 백틱 조각들에 문자 그대로 또는 인정된 약식 표기로 적혀 있는가. */
function documentedIn(spans: ReadonlySet<string>, glob: string): boolean {
  return Array.from(spans).some((span) => expandSpan(span).includes(glob))
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

/** 「검증 티어」 표의 행(`| **T1 …`)에서 조건 칸(둘째 칸) — 백틱 조각은 먼저 지운다(조각 안의 `|` 로 칸이 갈리지 않게). */
function conditionCell(row: string): string {
  return row.replace(/`[^`\n]+`/g, ' ').split('|')[2] ?? ''
}

/** T2 조건 칸의 군 이름 표기 `name(…)` — `·` 로 나뉜 항목 머리의 소문자 낱말 + 여는 괄호(한글 항목·괄호 안 낱말은 제외). */
function groupNamesInCell(cell: string): string[] {
  return Array.from(cell.matchAll(/(?:^|·)\s*([a-z][a-z0-9_-]*)\(/g), (m) => m[1])
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

  describe('3. 공유 파일', () => {
    it('lanes.shared 가 하네스 공유·인프라 목록 전체(AGENTS.md·.mcp.json·settings.local·commands·agent-memory 포함)를 포함한다', () => {
      expect(
        missingFrom(strings('lanes.shared'), REQUIRED_SHARED),
        'lanes.shared 에서 빠진 공유 파일 — 워커가 하네스 규칙·설정·기록(에이전트 메모리 포함)을 편집할 수 있게 된다',
      ).toEqual([])
    })

    it('U·W 레인 대표 경로는 lanes.shared 에 들지 않는다(공유 과확장 = 워커가 자기 레인을 편집 못 함)', () => {
      const shared = strings('lanes.shared')
      expect(
        [...U_LANE_SAMPLES, ...W_LANE_SAMPLES].filter((rel) => inLane(rel, shared)),
        'lanes.shared 글롭에 걸리는 U·W 레인 경로 — 구현 워커·계약 저자가 자기 레인 파일을 편집하지 못하게 된다(공유 과확장)',
      ).toEqual([])
    })
  })

  describe('4. 고위험 티어', () => {
    it('tiers.high.gate 가 CI·하네스 설정·에이전트/워크플로/명령/스킬/메모리·규칙 문서 경로 전체를 포함한다', () => {
      expect(
        missingFrom(strings('tiers.high.gate'), REQUIRED_GATE),
        'tiers.high.gate 에서 빠진 경로 — 그 파일을 바꾸는 PR 이 고위험(T2) 팬아웃 검증 없이 낮은 티어로 내려간다',
      ).toEqual([])
    })

    it('tiers.high 에 rls·auth·privacy·audit·money·storage·gate 군이 비어 있지 않은 글롭 배열로 있다', () => {
      const high = pick('tiers.high')
      const absent = REQUIRED_HIGH_GROUPS.filter((group) => {
        const globs = isRecord(high) ? high[group] : undefined
        return !(isStringArray(globs) && globs.length > 0)
      })
      expect(absent, 'tiers.high 에 없거나 비어 있는 고위험 군 — 그 경로를 바꾸는 PR 이 T2 로 오르지 않는다').toEqual([])
    })

    it('tiers.high 각 군이 필수 글롭(저작 시점 값)을 문자열 그대로 모두 포함한다', () => {
      const missing = Object.entries(REQUIRED_HIGH).flatMap(([group, required]) =>
        missingFrom(highGlobs(group), required).map((glob) => `${group}: ${glob}`),
      )
      expect(
        missing,
        'tiers.high 군에서 빠진 글롭 — 그 경로(RLS·인증·가명처리·감사·정산·storage·gate)를 바꾸는 PR 이 T1 단건 검증으로 내려간다',
      ).toEqual([])
    })

    it('군별 대표 경로(권한 경계 호출부 12개 포함)가 그 군의 글롭에 걸린다', () => {
      const unmatched = Object.entries(HIGH_SAMPLES).flatMap(([group, samples]) => {
        const globs = highGlobs(group)
        return samples.filter((rel) => !inLane(rel, globs)).map((rel) => `${group}: ${rel}`)
      })
      expect(
        unmatched,
        'tiers.high 군 글롭에 안 걸리는 고위험 경로 — pr-risk-tier 가 이 파일 PR 을 T2 로 올리지 않는다(view-as 쓰기 차단·admin 클라·감사 우회가 단건 검증으로)',
      ).toEqual([])
    })

    it('tiers.sqlPolicyRegex 가 비어 있지 않은 JS·awk 공통 ERE 이고, 정책·권한·함수·트리거·술어 샘플 줄을 모두 잡는다', () => {
      const re = pick('tiers.sqlPolicyRegex')
      // 키가 없거나 빈 문자열이면 pr-risk-tier.sh:63 이 FUNCTION·TRIGGER·seoul_* 가 빠진 기본 정규식으로 폴백한다.
      expect(typeof re === 'string' && re.length > 0, `${HARNESS_JSON} tiers.sqlPolicyRegex 가 없거나 비어 있음(실제: ${JSON.stringify(re)}) — 플러그인 기본 정규식으로 폴백`).toBe(true)
      const source = typeof re === 'string' ? re : ''
      // 플러그인은 `LC_ALL=C awk -v re=…` 로 쓴다: -v 는 역슬래시를 먼저 이스케이프로 해석하고, `(?`·`[[:`·게으른 수량자는
      // JS 와 ERE 의 뜻이 다르다 — 이것들이 없어야 아래 JS 매치가 플러그인(awk) 판정을 대변한다(체커 유효성).
      expect(
        [/\\/, /\(\?/, /\[\[:/, /[*+?}]\?/].filter((bad) => bad.test(source)).map(String),
        'sqlPolicyRegex 가 JS·awk ERE 공통 부분집합을 벗어남(역슬래시·(?·[[:·게으른 수량자) — 계약 매치가 플러그인 판정과 달라진다',
      ).toEqual([])
      const rx = (() => {
        try {
          return new RegExp(source)
        } catch (e) {
          throw new Error(`sqlPolicyRegex 가 정규식으로 컴파일되지 않음 — ${e instanceof Error ? e.message : String(e)}`)
        }
      })()
      expect(
        SQL_POLICY_SAMPLES.filter((line) => !rx.test(line)),
        'sqlPolicyRegex 가 안 잡는 SQL diff 줄 — 경로 글롭 밖 .sql 에서 정책·권한·RLS 술어·경로검사 트리거를 바꿔도 T2 로 오르지 않는다',
      ).toEqual([])
    })

    it('tiers.docs 가 `docs/**` 를 포함하고, 코드·빌드 SQL·스크립트·빌드 설정 경로는 잡지 않는다', () => {
      const docs = strings('tiers.docs')
      expect(missingFrom(docs, ['docs/**']), 'tiers.docs 에서 빠진 글롭').toEqual([])
      expect(
        DOCS_EXCLUDED_SAMPLES.filter((rel) => inLane(rel, docs)),
        'tiers.docs 에 걸리는 코드 경로 — 그 PR 이 VERIFY REPORT 없는 T0(docs, CI + 사람 읽기)로 내려간다',
      ).toEqual([])
    })

    it(`tiers.large 임계가 상한(files ≤ ${LARGE_MAX.files}, lines ≤ ${LARGE_MAX.lines}) 이하다`, () => {
      const over = (['files', 'lines'] as const)
        .filter((key) => {
          const v = pick(`tiers.large.${key}`)
          return !(typeof v === 'number' && v <= LARGE_MAX[key])
        })
        .map((key) => `${key}: ${JSON.stringify(pick(`tiers.large.${key}`))} (상한 ${LARGE_MAX[key]})`)
      expect(over, 'tiers.large 임계가 상한을 넘음 — 대형 PR 이 T2 팬아웃 검증을 건너뛴다').toEqual([])
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
        ['src/app/(supporter)/supporter/*/gallery/**', 'src/app/(supporter)/supporter/[participantId]/gallery/page.tsx', true], // 경로의 `[` 는 문자 그대로
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

  describe('6. CLAUDE.md 정합 (양방향)', () => {
    it('「레인 규칙」 절이 lanes.w 의 모든 글롭을 백틱으로 적는다(test/spec 4글롭은 brace 축약 1개로 대체 인정)', () => {
      const spans = codeSpans(claudeSection('### 레인 규칙'))
      expect(
        strings('lanes.w').filter((glob) => !documentedIn(spans, glob)),
        'CLAUDE.md 「레인 규칙」 요약에 없는 W 레인 글롭 — 정본(harness.json)과 요약이 어긋난다',
      ).toEqual([])
    })

    it('「레인 규칙」 절이 lanes.shared 의 모든 항목을 백틱으로 적는다(`.claude/settings*.json`·`.claude/agents|workflows|commands/**` 약식 인정)', () => {
      const spans = codeSpans(claudeSection('### 레인 규칙'))
      expect(
        strings('lanes.shared').filter((glob) => !documentedIn(spans, glob)),
        'CLAUDE.md 「레인 규칙」 요약에 없는 공유 항목 — 정본(harness.json lanes.shared)과 요약이 어긋난다',
      ).toEqual([])
    })

    it('「레인 규칙」 W 레인·공유 줄에 적힌 백틱 글롭이 전부 lanes.w·lanes.shared 에 있다(요약이 없는 보호를 약속하지 않음)', () => {
      const section = claudeSection('### 레인 규칙')
      const claimed = (prefix: string) =>
        Array.from(codeSpans(sectionLine(section, prefix)))
          .filter((span) => !span.startsWith('harness:')) // 에이전트 이름(`harness:w-contract-author`)은 글롭이 아니다
          .flatMap(expandSpan)
      const lanesW = strings('lanes.w')
      const shared = strings('lanes.shared')
      expect(
        [
          ...missingFrom(lanesW, claimed('- **W 레인**')).map((g) => `W 레인: ${g}`),
          ...missingFrom(shared, claimed('- **공유·인프라**')).map((g) => `공유: ${g}`),
        ],
        'CLAUDE.md 「레인 규칙」 이 적었지만 harness.json 레인에 없는 글롭 — 요약은 보호한다고 말하는데 lane-guard 는 막지 않는다',
      ).toEqual([])
    })

    it('「검증 티어」 절이 tiers.high 의 모든 군 이름을 적는다', () => {
      const section = claudeSection('### 검증 티어')
      const high = pick('tiers.high')
      if (!isRecord(high)) throw new Error(`${HARNESS_JSON} tiers.high 가 객체가 아님(실제: ${JSON.stringify(high)})`)
      expect(
        Object.keys(high).filter((group) => !mentionsGroup(section, group)),
        'CLAUDE.md 「검증 티어」 T2 요약에 없는 고위험 군 — 정본(harness.json tiers.high)과 요약이 어긋난다',
      ).toEqual([])
    })

    it('「검증 티어」 T2 행의 군 이름 표기 `name(…)` 이 전부 tiers.high 에 있다', () => {
      const names = groupNamesInCell(conditionCell(sectionLine(claudeSection('### 검증 티어'), '| **T2')))
      expect(names.length, 'CLAUDE.md T2 행에서 군 이름 `name(…)` 을 하나도 못 읽음 — 행 형식이 바뀌었으면 이 계약도 고친다').toBeGreaterThan(0)
      expect(
        names.filter((name) => highGlobs(name).length === 0),
        'CLAUDE.md T2 행이 적었지만 harness.json tiers.high 에 없는(또는 빈) 군 — 요약은 T2 라는데 pr-risk-tier 는 올리지 않는다',
      ).toEqual([])
    })

    it('「검증 티어」 T1 행의 임계(≤ N파일·≤ M줄)가 tiers.large 와 같다', () => {
      const cell = conditionCell(sectionLine(claudeSection('### 검증 티어'), '| **T1'))
      const files = pick('tiers.large.files')
      const lines = pick('tiers.large.lines')
      expect(
        [`≤ ${String(files)}파일`, `≤ ${String(lines)}줄`].filter((token) => !cell.includes(token)),
        `CLAUDE.md T1 행 임계가 harness.json tiers.large(${String(files)}파일·${String(lines)}줄)와 다름(행: ${cell.trim()})`,
      ).toEqual([])
    })
  })

  describe('7. 당사자 문구 글롭·검증 렌즈·역할 스킬·접근성 기준', () => {
    it('tiers.participantCopyGlobs 가 당사자 화면·공통 컴포넌트·쉬운 용어 사전·콘텐츠 4글롭을 모두 포함한다', () => {
      expect(
        missingFrom(strings('tiers.participantCopyGlobs'), REQUIRED_PARTICIPANT_COPY),
        'tiers.participantCopyGlobs 에서 빠진 글롭 — 그 경로의 당사자 문구 변경이 copy 승격(T2)·easy-read 검수 없이 지나간다',
      ).toEqual([])
    })

    it('verify.lenses 가 5렌즈(requirements-types·security-rls·a11y-copy·tests-mutation·docs-consistency)를 모두 포함한다', () => {
      expect(
        missingFrom(strings('verify.lenses'), REQUIRED_LENSES),
        'verify.lenses 에서 빠진 렌즈 — /harness:verify-pr 가 그 관점을 검증하지 않는다',
      ).toEqual([])
    })

    it('roleSkills.w 가 qa·pl·easy-read-review 를 포함한다(검증자·계약 저자가 쉬운 말 기준을 로드)', () => {
      expect(
        missingFrom(strings('roleSkills.w'), REQUIRED_W_SKILLS),
        'roleSkills.w 에서 빠진 스킬 — W 역할 에이전트가 그 검수 기준(쉬운 말 70점 등) 없이 검증한다',
      ).toEqual([])
    })

    it('CLAUDE.md 「접근성 원칙」 검증 체크 줄이 수치 기준(4.5:1·44px·jsx-a11y·≥ 70·3:1)을 적는다', () => {
      const line = sectionLine(claudeSection('## 접근성 원칙'), '- **검증 체크')
      expect(
        A11Y_CHECK_TOKENS.filter((token) => !line.includes(token)),
        'CLAUDE.md 접근성 검증 체크 줄에서 빠진 기준 — 플러그인 a11y-copy 렌즈엔 수치가 없어 이 줄이 w-verifier·QA 의 기준이다',
      ).toEqual([])
    })
  })

  describe('8. 채널(agent-sync)', () => {
    it('channel.seatPrefixes 가 사람 자리 3접두([DECISION by user]·[QA by user]·[MERGED by user])를 모두 포함한다', () => {
      expect(
        missingFrom(strings('channel.seatPrefixes'), REQUIRED_SEAT_PREFIXES),
        'channel.seatPrefixes 에서 빠진 접두 — agent-sync 가 w.md(사람 자리 기록)의 접두 가드를 끄거나 그 접두를 거부한다',
      ).toEqual([])
    })

    it("channel.branch 는 'agent-sync', roles.seat 는 'w' 다", () => {
      const actual = { 'channel.branch': pick('channel.branch'), 'roles.seat': pick('roles.seat') }
      expect(
        actual,
        '채널 브랜치·사람 자리 역할이 CLAUDE.md 「상태 동기화」 와 다름 — 인계문·사람 자리 기록이 다른 곳으로 가거나 접두 가드 대상이 바뀐다',
      ).toEqual({ 'channel.branch': 'agent-sync', 'roles.seat': 'w' })
    })
  })

  describe('9. 게이트 명령', () => {
    it('gate.all 이 tsc --noEmit·npm run lint·npm test·npm run build 를 && 로만 잇는다', () => {
      const all = text('gate.all')
      expect(
        REQUIRED_GATE_ALL_STEPS.filter((step) => !all.includes(step)),
        `gate.all 에서 빠진 단계(실제: ${JSON.stringify(all)}) — u-worker·w-verifier 가 그 검사 없이 초록을 선언한다`,
      ).toEqual([])
      expect(
        /[|;]|(^|[^&])&(?!&)/.test(all),
        `gate.all 에 \`||\`·\`|\`·\`;\`·단독 \`&\` 가 있음(실제: ${JSON.stringify(all)}) — 앞 단계 실패가 묻혀도 게이트가 통과한다`,
      ).toBe(false)
    })

    it('gate.contract 가 `vitest run` 과 `{file}` 자리표시를 포함한다', () => {
      const contract = text('gate.contract')
      expect(
        REQUIRED_GATE_CONTRACT_PARTS.filter((part) => !contract.includes(part)),
        `gate.contract 에서 빠진 조각(실제: ${JSON.stringify(contract)}) — 계약 저자·구현 워커가 계약 단건 RED/GREEN 을 확인하지 못한다`,
      ).toEqual([])
    })
  })
})
