import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, readdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * agent-sync 래퍼 계약 — `scripts/agent-sync.sh` 의 플러그인 부재 fail-safe + 플러그인 위임·탐색 순서 (W 레인).
 *
 * 배경: PR #199 가 하네스 런타임을 플러그인 `harness` 로 옮기고 저장소에는 얇은 래퍼만 남겼다(gate 군·공유 파일).
 *   래퍼 머리말의 약속: 플러그인이 없으면 `pull` 은 stderr 경고 한 줄 후 exit 0(세션 시작 훅을 깨지 않되 레인 가드·머지
 *   확인 훅이 꺼져 있음을 알린다), `post`·`log` 는 설치 안내와 함께 exit 3(기록 유실을 성공으로 보고하지 않는다).
 *   verify-pr #199 재검증(a68fb99, tests-mutation-5): `post`·`log` 의 `exit 3` 을 `exit 0` 으로 바꿔도 어떤 계약도 RED 가
 *   아니었다 — 이 계약이 그 돌연변이를 죽인다.
 *
 * 격리(네트워크 0 · 채널 쓰기 0):
 *   · HOME = 빈 임시 디렉터리 → `~/.claude/plugins`(installed_plugins.json·캐시·마켓플레이스) 후보가 모두 없다.
 *     ~/.gitconfig 의 자격 증명 도우미도 읽히지 않는다.
 *   · HARNESS_DEV_DIR·CLAUDE_CONFIG_DIR 는 환경에서 뺀다(개발 사본·설정 디렉터리 후보 제거 — CLAUDE_CONFIG_DIR 를 쓰는 개발
 *     머신에서 래퍼가 실제 플러그인을 찾아 격리 전제가 깨지지 않게). BASH_ENV·ENV 도 뺀다(시작 파일이 끼어들지 않게).
 *   · cwd = 비-git 임시 디렉터리 — 래퍼가 돌연변이로 실제 플러그인에 닿더라도 채널 저장소를 찾지 못한다.
 *   · GIT_TERMINAL_PROMPT=0 — 어떤 경로로도 자격 증명 프롬프트에서 멈추지 않는다.
 *   CI(ubuntu-latest, bash·jq·GNU sort 있음)·로컬 모두 같은 결과.
 *
 * 규칙(it 1개 = 규칙 1개):
 *   A. 플러그인 부재 fail-safe(가짜 HOME 이 빔 → 래퍼는 경로 탐색만 하고 fallback case 로 떨어진다)
 *     1. 격리 전제 — 가짜 HOME 이 비어 있다(체커 유효성: 비어 있지 않으면 아래 판정이 실제 플러그인을 탈 수 있다).
 *     2. `post u x` → rc 3 + stderr 설치 안내.
 *     3. `log` → rc 3.
 *     4. `pull` → rc 0 + stderr '미설치' 경고.
 *   B. 플러그인 위임·탐색 순서(가짜 설정 디렉터리 안의 스텁 `agent-sync.sh` — 자기 표지 한 줄 + 받은 인자를 한 줄씩 찍고
 *      `AGENT_SYNC_STUB_RC`(기본 0)로 끝난다. 스텁은 채널·네트워크에 닿지 않는다)
 *     5. `post u "a  b*"` → 스텁이 정확히 인자 3개(공백 두 칸·글롭 문자 보존)를 받는다 — cwd 에 `b` 로 시작하는 미끼 파일을
 *        두어 따옴표 없는 전달(`$*`·`$@`)이면 낱말 분리·글롭 확장이 드러나게 한다.
 *     6. `pull`·`log u` 도 스텁으로 위임된다(fallback 경고·rc 3 이 아니다).
 *     7. rc 는 스텁의 rc 다(`AGENT_SYNC_STUB_RC=42` → 42).
 *     8. 순서: HARNESS_DEV_DIR 가 installPath·캐시보다 먼저.
 *     9. 순서: installed_plugins.json 의 installPath(구버전 0.1.0 을 가리킴)가 캐시 최신(0.4.0)보다 먼저.
 *    10. installed_plugins.json 이 없으면 캐시 {0.1.0, 0.4.0} 중 최신 0.4.0.
 *   10b. 캐시 최신 판정은 버전 순서다({0.9.0, 0.10.0} → 0.10.0 — 사전순 아님).
 *    11. jq 가 없는 PATH 에서는 installed_plugins.json 이 있어도 캐시 최신 0.4.0.
 *    12. 캐시가 마켓플레이스 체크아웃보다 먼저.
 *    13. CLAUDE_CONFIG_DIR 가 있으면 그 아래(HOME/.claude 가 아니라) cache 스텁을 쓴다.
 *
 * 저작 시 돌연변이 RED 확인(37ce0ff 위, 샌드박스 사본에서): 23행 `exit 3` → `exit 0`(2·3 RED) · 22행 `exit 0` → `exit 3`(4 RED) ·
 *   22행 경고 echo 삭제(4 RED).
 * 4차 보강(verify-pr #199 재검증 8d5ca52 생존 돌연변이, b980fda 위 — 워크트리 대신 scratchpad 사본에서 걸고 원본으로 원복):
 *   위임 끔(`-f "$d/agent-sync.sh.none"`, B 전부 RED) · 인자 버림(`… pull`·인자 없음 → 5·6 RED) · 따옴표 없는 `$*`(5 RED) ·
 *   `exec` 없이 `; exit 0`(7 RED) · `sort -V | head -n1`(10·10b·11 RED) · `sort -V` → `sort`(10b RED) ·
 *   `cfg="$HOME/.claude"`(13 RED) · HARNESS_DEV_DIR 를 캐시 뒤로(8 RED) · installPath 를 캐시 최신 뒤로(9 RED) ·
 *   마켓플레이스를 캐시 앞으로·마켓플레이스 후보 삭제(12 RED). A 규칙 1~4 는 전부 그대로 GREEN.
 */

const ROOT = process.cwd()
const WRAPPER = join(ROOT, 'scripts/agent-sync.sh')
const INSTALL_HINT = 'claude plugin install harness@harness'
/**
 * 자식 환경에서 뺄 변수 — 개발 사본 후보(HARNESS_DEV_DIR)·설정 디렉터리(CLAUDE_CONFIG_DIR)·비대화형 bash 가 읽는
 * 시작 파일(BASH_ENV·ENV). B 규칙은 필요한 것만 다시 넣는다.
 */
const DROPPED_ENV: ReadonlySet<string> = new Set(['HARNESS_DEV_DIR', 'CLAUDE_CONFIG_DIR', 'BASH_ENV', 'ENV'])

let fakeHome = ''

beforeAll(() => {
  fakeHome = mkdtempSync(join(tmpdir(), 'agent-sync-wrapper-home-'))
})

afterAll(() => {
  if (fakeHome) rmSync(fakeHome, { recursive: true, force: true })
})

type Run = { rc: number | null; stdout: string; stderr: string; error?: string }

/** 가짜 HOME·HARNESS_DEV_DIR 미설정·비-git cwd 로 래퍼를 실행한다. */
function runWrapper(...args: string[]): Run {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: fakeHome, GIT_TERMINAL_PROMPT: '0' }
  for (const key of DROPPED_ENV) delete env[key]
  const r = spawnSync('bash', [WRAPPER, ...args], { cwd: fakeHome, env, encoding: 'utf8', timeout: 20_000 })
  return { rc: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message }
}

/** 실패 메시지용 실행 요약. */
function describeRun(r: Run): string {
  return `rc=${String(r.rc)}${r.error ? ` error=${r.error}` : ''} stderr=${JSON.stringify(r.stderr.trim())} stdout=${JSON.stringify(r.stdout.trim())}`
}

describe('agent-sync 래퍼 계약 — 플러그인 부재 fail-safe', () => {
  it('격리 전제: 가짜 HOME 이 비어 있다(플러그인 후보 경로가 하나도 없음)', () => {
    expect(readdirSync(fakeHome), '가짜 HOME 이 비어 있지 않음 — 래퍼가 실제 플러그인을 찾아 채널에 쓸 수 있다(체커 전제 위반)').toEqual([])
  })

  it('`post u x` 는 설치 안내와 함께 rc 3 이다(기록 유실을 성공으로 보고하지 않음)', { timeout: 30_000 }, () => {
    const r = runWrapper('post', 'u', 'x')
    expect(r.rc, `플러그인 없이 post 가 rc 3 이 아님 — 저널·사람 자리 기록이 사라져도 호출자는 성공으로 본다(${describeRun(r)})`).toBe(3)
    expect(r.stderr, `post 실패 안내에 설치 명령이 없음(${describeRun(r)})`).toContain(INSTALL_HINT)
  })

  it('`log` 는 rc 3 이다(채널을 못 읽었는데 빈 기록으로 보이지 않음)', { timeout: 30_000 }, () => {
    const r = runWrapper('log')
    expect(r.rc, `플러그인 없이 log 가 rc 3 이 아님 — 채널을 못 읽은 것이 "기록 없음"으로 보인다(${describeRun(r)})`).toBe(3)
  })

  it("`pull` 은 rc 0 이고 stderr 에 '미설치' 경고를 낸다(세션 훅은 깨지 않되 가드 비활성을 알림)", { timeout: 30_000 }, () => {
    const r = runWrapper('pull')
    expect(r.rc, `플러그인 없이 pull 이 rc 0 이 아님 — SessionStart 훅·스크립트가 깨진다(${describeRun(r)})`).toBe(0)
    expect(r.stderr, `플러그인 없이 pull 이 '미설치' 경고를 내지 않음 — 레인 가드·머지 확인 훅이 꺼진 줄 모른다(${describeRun(r)})`).toContain('미설치')
  })
})

// ── B. 플러그인 위임·탐색 순서 ─────────────────────────────────────────────────────────────────
const STUB_MARK = 'STUB='
const CACHE_REL = 'plugins/cache/harness/harness'
const MARKETPLACE_REL = 'plugins/marketplaces/harness'
/** 따옴표 없는 전달이면 낱말 분리(`a`·`b*`) + 글롭 확장(`b*` → 이 파일)으로 드러난다. */
const GLOB_BAIT = 'b_glob_bait'
/** jq 없는 PATH 에 둘 도구 — 래퍼가 쓰는 외부 명령(bash·ls·sort·tail)만. */
const MINIMAL_TOOLS: readonly string[] = ['bash', 'ls', 'sort', 'tail']

/** 스텁 `agent-sync.sh` — 표지 한 줄(`STUB=<label>`) + 받은 인자 한 줄씩 + `AGENT_SYNC_STUB_RC`(기본 0)로 종료. */
function writeStub(pluginRoot: string, label: string): void {
  const scripts = join(pluginRoot, 'scripts')
  mkdirSync(scripts, { recursive: true })
  writeFileSync(
    join(scripts, 'agent-sync.sh'),
    `#!/usr/bin/env bash\nprintf '${STUB_MARK}%s\\n' '${label}'\nprintf '%s\\n' "$@"\nexit "\${AGENT_SYNC_STUB_RC:-0}"\n`,
  )
}

type Layout = {
  /** 캐시 버전들 — `<cfg>/plugins/cache/harness/harness/<v>/scripts` (표지 `cache-<v>`). */
  cache?: readonly string[]
  /** installed_plugins.json 의 installPath 가 가리킬 캐시 버전(그 디렉터리는 cache 에 있어야 한다). */
  installPathVersion?: string
  /** HARNESS_DEV_DIR 개발 사본(표지 `dev`). */
  dev?: boolean
  /** 마켓플레이스 체크아웃 `<cfg>/plugins/marketplaces/harness/scripts` (표지 `marketplace`). */
  marketplace?: boolean
  /** true 면 설정 디렉터리 = CLAUDE_CONFIG_DIR(<root>/config), HOME 은 빈 디렉터리. 아니면 <HOME>/.claude. */
  configDir?: boolean
}

type Fixture = { home: string; cfg: string; cwd: string; env: NodeJS.ProcessEnv }
type StubRun = Run & { label: string | null; args: string[] }

describe('agent-sync 래퍼 계약 — 플러그인 위임·탐색 순서(스텁 플러그인)', () => {
  let root = ''
  let minimalBin = ''
  let seq = 0

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'agent-sync-wrapper-stub-'))
    // jq 없는 PATH — 래퍼가 쓰는 도구만 심볼릭 링크로 둔다.
    minimalBin = join(root, 'bin-nojq')
    mkdirSync(minimalBin)
    for (const tool of MINIMAL_TOOLS) {
      const found = (spawnSync('bash', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).stdout ?? '').trim()
      if (found.startsWith('/')) symlinkSync(found, join(minimalBin, tool))
    }
  })

  afterAll(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  /** 배치 하나를 새 임시 디렉터리에 만든다(테스트마다 독립). */
  function fixture(layout: Layout): Fixture {
    const base = join(root, `case-${++seq}`)
    const home = join(base, 'home')
    const cfg = layout.configDir ? join(base, 'config') : join(home, '.claude')
    const cwd = join(base, 'cwd')
    mkdirSync(home, { recursive: true })
    mkdirSync(cwd, { recursive: true })
    writeFileSync(join(cwd, GLOB_BAIT), '')
    for (const v of layout.cache ?? []) writeStub(join(cfg, CACHE_REL, v), `cache-${v}`)
    if (layout.marketplace) writeStub(join(cfg, MARKETPLACE_REL), 'marketplace')
    if (layout.installPathVersion) {
      const installPath = join(cfg, CACHE_REL, layout.installPathVersion)
      mkdirSync(join(cfg, 'plugins'), { recursive: true })
      writeFileSync(
        join(cfg, 'plugins', 'installed_plugins.json'),
        JSON.stringify({ version: 2, plugins: { 'harness@harness': [{ scope: 'user', installPath, version: layout.installPathVersion }] } }),
      )
    }
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, GIT_TERMINAL_PROMPT: '0' }
    for (const key of DROPPED_ENV) delete env[key]
    if (layout.configDir) env.CLAUDE_CONFIG_DIR = cfg
    if (layout.dev) {
      const devDir = join(base, 'dev')
      writeStub(devDir, 'dev')
      env.HARNESS_DEV_DIR = devDir
    }
    return { home, cfg, cwd, env }
  }

  /** 배치 안에서 래퍼를 실행하고 스텁 출력(표지·인자)을 읽는다. */
  function runIn(fx: Fixture, args: readonly string[], extraEnv: Readonly<Record<string, string>> = {}): StubRun {
    const env: NodeJS.ProcessEnv = { ...fx.env, ...extraEnv }
    const r = spawnSync('bash', [WRAPPER, ...args], { cwd: fx.cwd, env, encoding: 'utf8', timeout: 20_000 })
    const stdout = r.stdout ?? ''
    const lines = stdout.split('\n')
    if (lines[lines.length - 1] === '') lines.pop()
    const marked = lines[0]?.startsWith(STUB_MARK) ?? false
    return {
      rc: r.status,
      stdout,
      stderr: r.stderr ?? '',
      error: r.error?.message,
      label: marked ? lines[0].slice(STUB_MARK.length) : null,
      args: marked ? lines.slice(1) : [],
    }
  }

  const hasJq = (env: NodeJS.ProcessEnv) => spawnSync('bash', ['-c', 'command -v jq'], { env, encoding: 'utf8' }).status === 0

  it('`post u "a  b*"` 는 스텁에 인자 3개를 그대로 넘긴다(공백 두 칸·글롭 문자 보존, rc 0)', { timeout: 30_000 }, () => {
    const fx = fixture({ cache: ['9.9.9'] })
    const r = runIn(fx, ['post', 'u', 'a  b*'])
    expect(r.label, `스텁 플러그인이 있는데 위임하지 않음(${describeRun(r)})`).toBe('cache-9.9.9')
    expect(r.args, `post 인자가 바뀌어 전달됨 — 따옴표 없는 전달(낱말 분리·글롭 확장)·인자 버림·명령 바꿔치기(${describeRun(r)})`).toEqual(['post', 'u', 'a  b*'])
    expect(r.rc, `위임된 post 의 rc 가 스텁 rc(0)가 아님(${describeRun(r)})`).toBe(0)
  })

  it('`pull`·`log u` 도 스텁으로 위임된다(fallback 경고·rc 3 이 아님)', { timeout: 30_000 }, () => {
    const fx = fixture({ cache: ['9.9.9'] })
    const pull = runIn(fx, ['pull'])
    expect([pull.label, pull.args, pull.rc], `pull 이 스텁으로 위임되지 않음(${describeRun(pull)})`).toEqual(['cache-9.9.9', ['pull'], 0])
    expect(pull.stderr, `플러그인이 있는데 pull 이 '미설치' 경고를 냄(${describeRun(pull)})`).not.toContain('미설치')
    const log = runIn(fx, ['log', 'u'])
    expect([log.label, log.args, log.rc], `log 가 스텁으로 위임되지 않음(${describeRun(log)})`).toEqual(['cache-9.9.9', ['log', 'u'], 0])
  })

  it('래퍼 rc 는 스텁의 rc 다(AGENT_SYNC_STUB_RC=42 → 42)', { timeout: 30_000 }, () => {
    const fx = fixture({ cache: ['9.9.9'] })
    const r = runIn(fx, ['post', 'u', 'x'], { AGENT_SYNC_STUB_RC: '42' })
    expect(r.label, `스텁 플러그인이 있는데 위임하지 않음(${describeRun(r)})`).toBe('cache-9.9.9')
    expect(r.rc, `래퍼가 플러그인 rc 를 바꿈 — post 실패(기록 유실)가 호출자에게 성공으로 보일 수 있다(${describeRun(r)})`).toBe(42)
  })

  it('HARNESS_DEV_DIR 가 installPath·캐시보다 먼저 선택된다', { timeout: 30_000 }, () => {
    const fx = fixture({ dev: true, installPathVersion: '0.1.0', cache: ['0.1.0', '0.4.0'] })
    expect(hasJq(fx.env), 'jq 가 PATH 에 없음 — installPath 후보가 만들어지지 않아 이 순서 판정이 약해진다(CI ubuntu-latest 에는 기본 설치)').toBe(true)
    const r = runIn(fx, ['log'])
    expect(r.label, `개발 사본(HARNESS_DEV_DIR)이 먼저 선택되지 않음 — 플러그인 개발 중 설치본이 실행된다(${describeRun(r)})`).toBe('dev')
  })

  it('installed_plugins.json 의 installPath(0.1.0)가 캐시 최신(0.4.0)보다 먼저 선택된다', { timeout: 30_000 }, () => {
    const fx = fixture({ installPathVersion: '0.1.0', cache: ['0.1.0', '0.4.0'] })
    expect(hasJq(fx.env), 'jq 가 PATH 에 없음 — installPath 우선 규칙은 jq 가 있어야 판정된다(CI ubuntu-latest 에는 기본 설치)').toBe(true)
    const r = runIn(fx, ['log'])
    expect(r.label, `installPath 가 캐시 최신보다 먼저 선택되지 않음 — Claude Code 가 쓰는 설치본과 다른 사본이 채널을 쓴다(${describeRun(r)})`).toBe('cache-0.1.0')
  })

  it('installed_plugins.json 이 없으면 캐시 {0.1.0, 0.4.0} 중 최신 0.4.0 이 선택된다', { timeout: 30_000 }, () => {
    const fx = fixture({ cache: ['0.1.0', '0.4.0'] })
    const r = runIn(fx, ['log'])
    expect(r.label, `캐시 최신이 선택되지 않음 — 가장 오래된 플러그인(0.1.0)이 실행된다(${describeRun(r)})`).toBe('cache-0.4.0')
  })

  it('캐시 최신 판정은 버전 순서다(0.10.0 > 0.9.0 — 사전순이 아님)', { timeout: 30_000 }, () => {
    const fx = fixture({ cache: ['0.9.0', '0.10.0'] })
    const r = runIn(fx, ['log'])
    expect(r.label, `캐시 최신을 사전순으로 고름 — 0.10.0 대신 0.9.0 이 실행된다(${describeRun(r)})`).toBe('cache-0.10.0')
  })

  it('jq 가 없는 PATH 에서는 installed_plugins.json 이 있어도 캐시 최신 0.4.0 이 선택된다', { timeout: 30_000 }, () => {
    const fx = fixture({ installPathVersion: '0.1.0', cache: ['0.1.0', '0.4.0'] })
    expect(readdirSync(minimalBin).sort(), `jq 없는 PATH 에 래퍼 도구(${MINIMAL_TOOLS.join('·')})를 못 둠 — 체커 전제`).toEqual([...MINIMAL_TOOLS].sort())
    expect(hasJq({ ...fx.env, PATH: minimalBin }), 'jq 없는 PATH 에서 jq 가 보임 — 체커 전제 위반').toBe(false)
    const r = runIn(fx, ['log'], { PATH: minimalBin })
    expect(r.label, `jq 없이 캐시 최신이 선택되지 않음 — Windows Git Bash(jq 미동봉)에서 오래된 플러그인이 실행된다(${describeRun(r)})`).toBe('cache-0.4.0')
  })

  it('캐시가 마켓플레이스 체크아웃보다 먼저 선택되고, 캐시가 없으면 마켓플레이스가 선택된다', { timeout: 30_000 }, () => {
    const both = runIn(fixture({ cache: ['0.4.0'], marketplace: true }), ['log'])
    expect(both.label, `캐시보다 마켓플레이스 체크아웃이 먼저 선택됨(${describeRun(both)})`).toBe('cache-0.4.0')
    const onlyMarketplace = runIn(fixture({ marketplace: true }), ['log'])
    expect(onlyMarketplace.label, `마켓플레이스 체크아웃 후보가 없음(${describeRun(onlyMarketplace)})`).toBe('marketplace')
  })

  it('CLAUDE_CONFIG_DIR 가 있으면 HOME/.claude 가 아니라 그 아래 cache 스텁이 선택된다', { timeout: 30_000 }, () => {
    const fx = fixture({ configDir: true, cache: ['9.9.9'] })
    expect(readdirSync(fx.home), '가짜 HOME 이 비어 있지 않음 — CLAUDE_CONFIG_DIR 판정이 HOME/.claude 로 통과할 수 있다(체커 전제 위반)').toEqual([])
    const r = runIn(fx, ['post', 'u', 'x'])
    expect([r.label, r.rc], `CLAUDE_CONFIG_DIR 아래 플러그인을 못 찾음 — 설치돼 있는데 '미설치'로 post·log 가 rc 3(${describeRun(r)})`).toEqual(['cache-9.9.9', 0])
  })
})
