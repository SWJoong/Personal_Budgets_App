import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * agent-sync 래퍼 계약 — `scripts/agent-sync.sh` 의 플러그인 부재 fail-safe (W 레인).
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
 *   · HARNESS_DEV_DIR 는 환경에서 뺀다(개발 사본 후보 제거). BASH_ENV·ENV 도 뺀다(시작 파일이 끼어들지 않게).
 *   · cwd = 그 빈 디렉터리(git 저장소 아님) — 래퍼가 돌연변이로 실제 플러그인에 닿더라도 채널 저장소를 찾지 못한다.
 *   · GIT_TERMINAL_PROMPT=0 — 어떤 경로로도 자격 증명 프롬프트에서 멈추지 않는다.
 *   CI(ubuntu-latest, bash 있음)·로컬 모두 같은 결과: 래퍼는 경로 탐색만 하고 fallback case 로 떨어진다.
 *
 * 규칙(it 1개 = 규칙 1개):
 *   1. 격리 전제 — 가짜 HOME 이 비어 있다(체커 유효성: 비어 있지 않으면 아래 판정이 실제 플러그인을 탈 수 있다).
 *   2. `post u x` → rc 3 + stderr 설치 안내.
 *   3. `log` → rc 3.
 *   4. `pull` → rc 0 + stderr '미설치' 경고.
 *
 * 저작 시 돌연변이 RED 확인(37ce0ff 위, 샌드박스 사본에서): 23행 `exit 3` → `exit 0`(2·3 RED) · 22행 `exit 0` → `exit 3`(4 RED) ·
 *   22행 경고 echo 삭제(4 RED).
 */

const ROOT = process.cwd()
const WRAPPER = join(ROOT, 'scripts/agent-sync.sh')
const INSTALL_HINT = 'claude plugin install harness@harness'
/** 자식 환경에서 뺄 변수 — 개발 사본 후보(HARNESS_DEV_DIR)·비대화형 bash 가 읽는 시작 파일(BASH_ENV·ENV). */
const DROPPED_ENV: ReadonlySet<string> = new Set(['HARNESS_DEV_DIR', 'BASH_ENV', 'ENV'])

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
