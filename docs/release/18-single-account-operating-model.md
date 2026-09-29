# 18 · 단일 계정 운영 모델 — W·U 를 계정에서 역할로, 하네스를 플러그인으로

> **한 줄**: W(Windows/개인) 계정 한도 부족으로, 한 계정의 **오케스트레이터 세션 + 서브에이전트**가 W·U 두 역할 컨텍스트를 분리 실행한다.
> **사람 자리(W)** = QA · PR 머지 · 결정(U 세션에서도 가능). 하네스 런타임은 플러그인 `harness` 로 추출해 여러 프로젝트에 재사용하고,
> 이 저장소에는 `.claude/harness.json` 만 남긴다.

관련: [`docs/harness-plan.md`](../harness-plan.md) v2(§10 전환 기록) · CLAUDE.md 「병렬 하네스」 · [`04`](04-u-parallel-orchestration.md)(병렬 워커 운영모델) ·
[`17`](17-harness-codification.md)(코드화, 부품은 플러그인으로 이전) · 실행 계획은 저장소 밖(사용자 로컬, 승인 2026-09-27) — 결정 요지는 §2·`docs/release/decisions.md` 가 정본.

---

## 1. 왜

| 실측 | 의미 |
|---|---|
| agent-sync 채널: 다른 머신 유입 마지막 2026-09-03, 게시 수 W 62 vs U 264 | W 세션은 사실상 멈춤 |
| 2026-09-04부터 U 단일세션이 양축 대행 — 메모리와 CLAUDE.md 현황 한 줄에만 존재 | 새 세션마다 재해석 비용, 문서와 실제의 괴리 |
| 홈 지시서 `~/.claude/CLAUDE.md` "W 레인 열지도 말 것" | 실제 운영과 반대되는 지시가 매 세션 로드 |
| 워커·검증자 정의 없음(#197 이전) → spawn 마다 브리핑 재작성 | 토큰·누락(첫 웨이브 재작업 사례) |
| 같은 하네스를 다른 프로젝트에도 써야 함 | 저장소 로컬 사본은 개선이 전파되지 않음 |

## 2. 사용자 결정 (2026-09-27, `docs/release/decisions.md` D-20260927-02~06)

| # | 결정 | 해석 |
|---|---|---|
| D-02 | W = 사람 자리(QA·PR 머지·결정), **U 측에서도 가능**해야. 나머지는 U 세션 전용 | W 는 계정이 아니라 사람의 자리. 검증·계약 저작은 서브에이전트 |
| D-03 | 오케스트레이터의 W 레인 편집 = 위임 원칙 + 소규모 예외 | 훅이 `ask` 로 묻고, 허용은 기록 |
| D-04 | 검증 비용 = 위험도 티어 | docs / small / high |
| D-05 | 문서는 역할 기반 재작성 + 전환 기록(홈 지시서 포함) | 이 문서 + harness-plan v2 §10 |
| D-06 | 플러그인 + 설치 스킬 · 프라이빗 레포 · PBA 는 #197 머지 → 추출 → 중복 제거 · 파일럿은 PBA만 | 플러그인 `harness` |

## 3. 역할 지도

| 역할 | 실행 주체 | 입력 | 출력(리턴 블록) | 편집 범위 |
|---|---|---|---|---|
| 오케스트레이터(U 세션) | 메인 컨텍스트 | 사용자 지시 · 채널 인계 · 백로그 | 웨이브 편성 · 티어 판정 · 머지 브리핑 · 저널 | 공유·인프라·docs/release + 소규모 예외 |
| `harness:u-worker` | sonnet · worktree · background | 태스크 · 화이트리스트 · 기준 브랜치 | `=== WORKER REPORT ===` + feat PR | U 레인(훅 deny) |
| `harness:w-contract-author` | opus · worktree · background | 설계·수용 기준 | `=== CONTRACT REPORT ===` + draft 계약 PR | W 레인(훅 deny) |
| `harness:w-verifier` · `/harness:verify-pr` | opus · Edit/Write 불가 | PR 번호 | `VERIFY-REPORT` 헤더 + `=== VERIFY REPORT ===` | 없음 |
| 사람 자리(W) | 사용자 | 브리핑 | 승인 · QA 결과 · 결정 | 전부 |

핵심 규칙: **같은 기능의 구현과 계약을 한 컨텍스트가 함께 쓰지 않는다.**

## 4. 레인 → 컨텍스트 (lane-guard 가 막는 것 / 못 막는 것)

- 플러그인 훅 `lane-guard.sh auto` 가 입력 JSON 의 `agent_type` 으로 판정: `harness:u-worker` → W 레인·공유 deny / `harness:w-contract-author` → W 레인 밖·공유 deny /
  `harness:w-verifier` → 허용(편집 도구 없음) / 메인 세션·기타 서브에이전트 → W 레인이면 **ask**(사용자 확인), 공유·U 레인은 조용히 허용.
- 소규모 예외 정의: 경로·주석·오타·현황 갱신 같은 **동작을 바꾸지 않는** 편집. 허용했으면 PR 본문·리포트 LANE_NOTES 에 남긴다.
- 못 막는 것: Bash 편집(`sed -i`·리다이렉트) → 에이전트 본문 규율. 프로젝트/플러그인 훅은 폴더 trust 후 실행.
- 이스케이프: `LANE_GUARD_DISABLE=1`(전부) · `LANE_GUARD_MAIN=off`(ask 만).
- **v0.3.0 강화(2026-09-28, verify-pr #198 지적 반영)**: 레인 판정은 대상 파일이 속한 worktree 의 `harness.json` 기준 · 워커는 자기 worktree 밖(다른 worktree·메인 체크아웃) 편집 차단 · 설정 없으면 워커는 내장 기본 레인, 설정 파싱 실패면 워커 차단(fail-closed)·메인 세션 ask · `agent_type` 은 접두 포함 정확 일치(`harness:w-verifier` 만 허용) · `**/` 는 0개 이상 디렉터리(`src/x.test.ts` 도 W 레인).
- **격리 worktree 는 origin/main 기준**: 서브에이전트가 받는 worktree 에는 main 의 파일만 있다. 따라서 `harness.json` 이 main 에 머지돼야 워커가 프로젝트 레인의 보호를 받는다(그 전엔 기본 레인). 라이브 실증(2026-09-28, `harness:u-worker`): main 에 아직 설정이 없어 v0.2.0 가드가 fail-open 했고, 워커는 규율대로 두 편집을 되돌려 클린 종료 — 이 관찰이 v0.3.0 의 '설정 없음 = 기본 레인' 규칙의 근거다.

## 5. 검증 티어 (정본 `.claude/harness.json` `tiers`)

요약은 CLAUDE.md 「검증 티어」 표, 판정 정본은 `.claude/harness.json` `tiers` 다(설정 계약 `src/test/harnessConfig.test.ts` 가 둘의 정합을 CI 에서 확인한다). 이 문서에는 경로를 다시 나열하지 않는다 — 세 곳에 나열하면 어긋난다(2026-09-28 재검증에서 storage 군 누락이 이 절과 harness-plan 에 남아 있었다).

- **docs**: 문서만. 단 gate 군의 규칙 파일은 `.md` 여도 high.
- **small**: 코드 ≤ 12파일·≤ 400줄, 고위험 경로 없음 → `harness:w-verifier` 1건(돌연변이 포함).
- **high**: 고위험 군(rls·auth·privacy·audit·money·storage·gate) · SQL 정책/함수/트리거 diff · 대형 · 당사자 문구 추가 → `/harness:verify-pr N`.

경계: 계약 PR 제외 · **계산 티어 아래로 하향하는 수단은 없다**(게이트가 선언·계산 중 높은 쪽을 적용 — 계산이 과하면 `tiers` 를 고치는 PR 로) · 재검증은 `--lens` 로 생존 렌즈만 · 고위험군은 문서 판정보다 우선(`CLAUDE.md`·`.claude/skills/**`·`docs/harness-plan.md`·PR 템플릿·`scripts/agent-sync.sh` 는 .md/.sh 여도 gate) · src 를 바꾸지 않는 문서·설정 PR 은 돌연변이 대신 설정 계약(`src/test/harnessConfig.test.ts`)으로 조인다.

## 6. 사람 자리 절차 3종 (U 세션에서도)

- **머지**: 플러그인 `pr-merge-gate.sh N check`(draft 아님 · CI green · `VERIFY-REPORT` 코멘트의 `head=` 가 현재 head · 판정 · 티어 · Manual-Ops) → 오케스트레이터 브리핑(PR·head·티어·판정·Manual-Ops·되돌림) →
  AskUserQuestion **PR 1건·head 1개당 승인 1회** → `pr-merge-gate.sh N merge --approved-by "user via U <시각>"`(승인 코멘트 → BEHIND 면 update-branch·CI 재확인 → head 재검증 → `--match-head-commit` squash → 계약 PR 닫기 → `post u [MERGED]`; 훅이 한 번 더 묻는다) →
  `scripts/agent-sync.sh post w "[MERGED by user] #N …"`. `--admin`·일괄 승인·auto-merge 금지. #197 은 게이트 이전의 수동 절차로 머지했다.
  **스택 PR**: 게이트 `merge` 실행 **전에** `gh pr list --base <head 브랜치>` 로 의존 PR 을 찾아 `gh api -X PATCH …/pulls/<N> -f base=main` 으로 재타깃한다(게이트가 squash 와 함께 head 브랜치를 지운다) — #197 머지 시 base 삭제로 #198 이 자동 종료돼 #199 로 재개설한 사례.
  **기록 ≠ 인증**: 채널(`w.md`)·`decisions.md`·`qa-runs/` 는 에이전트도 쓸 수 있는 기록이다. 승인·티어 하향·Manual-Ops 실행 시점은 세션 안 AskUserQuestion 으로만 성립하고, 기록은 그 결과를 남기는 용도다(공유 파일로 지정해 워커 편집은 차단).
- **QA**: `docs/release/qa-runs/` 규약(README). 사람이 실행, 오케스트레이터가 준비·기록. 브라우저는 관찰·증거 수집만. `post w "[QA by user] …"`.
- **결정**: AskUserQuestion → `docs/release/decisions.md` 행 + `post w "[DECISION by user] …"`. 수렴 프로토콜 폐기.

## 7. 어떤 파일이 어떻게 바뀌었나

| 위치 | 변경 |
|---|---|
| **플러그인 `harness`**(`~/문서/claude-harness` → private `SWJoong/claude-harness`) | `agents/`(u-worker·w-contract-author·w-verifier, 프로젝트 중립) · `workflows/verify-pr.js`(렌즈·반박자 설정 가능, `--lens`) · `hooks/hooks.json`(SessionStart pull · lane-guard auto · merge-ask) · `scripts/`(lane-guard·agent-sync·wave-plan·merge-ask·pr-risk-tier·pr-merge-gate·qa-run + selftest 4종) · `commands/qa-run.md` · `skills/install`·`operate` · README |
| 삭제(플러그인이 대체) | `.claude/agents/*` · `.claude/workflows/verify-pr.js` · `scripts/lane-guard.sh`·`lane-guard-selftest.sh` · `scripts/u-wave-plan.sh` · `.claude/settings.json` SessionStart 훅 |
| 추가 | `.claude/harness.json`(정본) · `.github/pull_request_template.md` · `docs/release/decisions.md` · `docs/release/qa-runs/README.md` · `src/test/harnessConfig.test.ts`(설정 계약, #202·#203) · 이 문서 |
| 제외 | `.claude/agent-memory/harness-w-verifier/*`(검증자 메모리 6개) — b9aed51 에 섞여 들어갔다가 재검증 지적으로 추적 해제. 메모리는 로컬 전용(`.gitignore`, D-20260928-03) — 워커 2종은 플러그인 0.3.1 에서 `memory: user` |
| 재작성 | CLAUDE.md 하네스 섹션(역할 지도·레인·티어·사람 자리 절차·현황 정리) · `docs/harness-plan.md` v2 · `scripts/agent-sync.sh`(래퍼) |
| 문구 | `04`(§1·§3·§5·§7·§8) · `17`(이전 안내) · `02`(리뷰 정책) · `14`(W 백로그 실행 주체) · `docs/release/README.md` · `.claude/skills/README.md` |
| 저장소 밖(사용자·오케스트레이터) | `~/.claude/CLAUDE.md` 오케스트레이터 지시서(플러그인 `home-directive.md`) · 홈 디렉터리 `AGENTS.md` 축소 · 메모리 갱신 · private repo 생성·마켓플레이스 전환 · Windows 머신 설치 |

## 8. 되돌림 — W 계정 세션이 복귀할 때

역할 재배치만 한다: 사람 자리 2개(Windows 에서도 `post w`), 또는 사람이 w-verifier 절차를 직접 운전하는 보조 검증 세션. agent-sync·레인·접두·플러그인은 그대로.
Remote Control 이 양쪽에 연결돼 있으면 `SendMessage` 를 라이브 보조 채널로 쓸 수 있다(정본은 여전히 agent-sync).

## 9. 검증 기록

- 플러그인 `harness` 0.1.0(로컬 마켓플레이스 `~/문서/claude-harness`, user scope 설치): `claude plugin validate` ✔ · `lane-guard-selftest.sh` pass=49 fail=0 · `merge-ask-selftest.sh` pass=12 fail=0 · `verify-pr.js` meta/본문 `node --check` 통과.
- 새 세션 인식(2026-09-27): 에이전트 `harness:u-worker`·`harness:w-contract-author`·`harness:w-verifier`, 스킬 `/harness:install`·`/harness:operate`, 워크플로 `/harness:verify-pr` 이 모두 나열됨. SessionStart 훅이 `agent-sync.sh pull --hook` 을 실행해 채널 상태(`w.md · 사람 자리` / `u.md · 오케스트레이터 저널`)를 출력.
- 이 저장소 `.claude/harness.json` 로 `lane-guard.sh auto` 실측: 메인 세션 `src/test/x.test.ts`·`Plan&Source/x_W.md` → **ask** / `CLAUDE.md`·`src/utils/x.ts` → 허용 / `harness:u-worker` `src/test/x.test.ts`·`scripts/agent-sync.sh` → **차단(2)**, `supabase/seoul/21_x.sql` → 허용 / `harness:w-contract-author` `src/utils/x.ts` → **차단(2)**, `verify_x.sql` → 허용.
- `merge-ask.sh` 에 `gh pr merge 197 --squash` → **ask** JSON. `scripts/agent-sync.sh pull`(래퍼) → 플러그인 스크립트로 위임되어 채널 출력. `wave-plan.sh` → "대상 핸드오프 없음"(오픈 계약 PR 0건).
- 소스 변경 없음(`src/**` 무변경) → `npm test` 는 #197 기준 155 파일·1056 테스트 통과가 유효. CI(quality-check·db-verify)는 PR 에서 재확인.
- 라이브 spawn(`harness:u-worker` 1건, 2026-09-28): worktree 가 origin/main 기준이라 `harness.json` 부재 → 설치본 0.1.0 가드 fail-open(아래 설치본 실측 참조), 워커는 규율대로 편집을 되돌리고 클린 종료. → 0.3.0 에서 '설정 없음 = 기본 레인' 으로 수정.
- `/harness:verify-pr`(#198 대상, 14 에이전트·4렌즈, 11.7h): 판정 changes-requested, findings 35(높음 3 · 보통 16 · 낮음 16), 기각 2. **반영(플러그인 0.3.0 + 이 PR)**: 레인 가드 자기 worktree 밖 차단·설정 없음/파손 fail-closed·agent_type 정확 일치·`**/` 0-depth · merge-ask 변형(`bash -c`·`gh api …/merge`·refspec·force) 대응 · 고위험군이 문서 판정보다 우선(CLAUDE.md·스킬·harness-plan·PR 템플릿 = gate) · tiers.high 누락 경로군(api/**·ruleCheck·storage·privacy 유틸·SQL 함수/트리거) · participantCopyGlobs 확장 · docs-consistency 렌즈 · lanes.shared 에 decisions/qa-runs/agents/workflows/commands · 에이전트 스킬 로드 폴백(Read) · 래퍼 fail-safe 축소(post·log exit 3)·개인 경로 제거 · enabledPlugins 선언 · 결정 로그 날짜 정정 · 스택 PR 재타깃 절차 · 기록≠인증 명시 · 접근성 검증 체크 항목 · 정적 계약 `src/test/harnessConfig.test.ts`(w-contract-author) · stale 참조 2건.
- 정적 설정 계약(#202, `harness:w-contract-author`, 2026-09-28): `src/test/harnessConfig.test.ts` 13 테스트 — 파싱·키 형태·lanes.w/shared 필수 항목·tiers.high 군·글롭 매처(플러그인 `hc_match` 와 4263 쌍 대조 불일치 0)·CLAUDE.md 「레인 규칙」/「검증 티어」 정합. 첫 실행 1 RED = `tiers.high.storage` 가 CLAUDE.md T2 요약에 없던 실제 드리프트 → CLAUDE.md 한 줄로 해소(계약은 약화하지 않음). 필수 돌연변이 3 + 추가 18 전부 RED. 병합 후 게이트: 계약 13/13 · tsc 0 · lint 오류 0 · `npm test` 156 파일·1069 테스트 · build ✓.
- 설정 계약 보강(#203, 2026-09-28): 29 규칙 — 군별 필수 글롭·대표 경로 75·sqlPolicyRegex 샘플 15·docs 배제·large 상한·채널·게이트 명령·CLAUDE.md 양방향. fbd70a8 재검증의 생존 돌연변이 포함 62종 전부 RED. 병합 후 `npm test` 156 파일·1085 테스트. 재검증(a68fb99) = approve-with-conditions(보통 6: 플러그인 0.3.1 선행 강제·계약 빈틈·스택 PR 순서) → 3차 계약 #204(35 규칙 + agent-sync 래퍼 계약 4)·절차 정정·minVersion 0.4.0.
- 플러그인 0.4.0(SWJoong/claude-harness#1, 머지 2026-09-29 `85ed748`, 사용자 승인): 에이전트 메모리 자기 폴더·워커 `memory: user` · `realpath -L -m`(링크 뒤 `..` 우회) · `.git/`·`~/.claude`·`CLAUDE_CONFIG_DIR`·저장소 밖 쓰기 차단 · 대소문자 무시 FS(루트·상대 경로 대소문자, ASCII 로 접히는 13자, 무시 코드포인트 — ASCII 골격 판정)·Windows 끝 점/공백 · 머지 게이트 리포트 헤더 정규화·계약 PR 닫기 판정·`--accept-memory`. 독립 검증 6차(1~5차 approve-with-conditions → 6차 approve) + 델타 approve(차등 퍼즈 7488쌍, 느슨해진 전이 0). selftest lane-guard 209(casefold 16)·merge-ask 30·pr-risk-tier 23·pr-merge-gate 48. 설치본 0.4.0 갱신(새 세션부터).
- 설치본 버전 실측(2026-09-28): 로컬 경로 마켓플레이스도 설치 시점 사본(`~/.claude/plugins/cache/harness/harness/<version>/`)을 실행한다 — 이 PR 작업 세션의 훅·에이전트 정의는 **0.1.0** 이었다(`hooks.json`·`verify-pr.js` 는 0.3.0 과 동일, 에이전트 본문·스크립트는 상이). 같은 날 `claude plugin update harness@harness` 로 0.3.0 설치. 0.3.0 가드의 라이브 확인은 이 PR 머지 후 새 세션에서 `harness:u-worker` 재spawn 으로 한다. 플러그인 README 설치 절 정정.
- **후속(이 PR 밖)**: `enforce_admins: true`(브랜치 보호 — 사용자 결정) · 플러그인 버전 고정(`plugin.minVersion` 은 정보용, tag 기반 pin + CI 에서 플러그인 selftest 를 이 저장소 harness.json 으로 실행) · `gate.contractSql`(verify SQL 실행기) 분리 · `.github/workflows` 에 `jq empty .claude/harness.json` 단계(정적 계약이 대신 잡음) · Vercel Ignored Build Step · Windows 머신 설치 · 플러그인 0.4.1 후속(0.4.0 델타 검증 낮음 4): 골격 분기 selftest 3줄 · 가드 주석 드리프트 · Windows 8.3 짧은 이름·NTFS 스트림·역슬래시 별칭(미검증) · 비워커 확인 질문의 끝 점/공백 · 플러그인 후속: 게이트 check 에 스택 의존 PR 경고 행 · 메인 세션의 검증자 메모리 편집 ask · participantCopyGlobs 접근성 속성 diff 승격(a11yRegex, 사람 결정) · `src/app/layout.tsx`(제3자 분석 스크립트)의 privacy 군 편입(사람 결정).

## 부록 A · CLAUDE.md 「현재 작업 현황」 이력 (2026-08-19 ~ 2026-09-20, 원문 이관)

> 원문 그대로(당시 표현 '활성(W)/활성(U)' 등은 2계정 시절 기준). 현행 현황은 CLAUDE.md.

<!-- 양쪽이 작업 시작/완료 시 갱신·push -->
- **활성(W)**: 축B(#17·#18·#20) 랜딩·verify PG15 green 확인 → verify CI 자동화 스펙 `[HANDOFF→U]`(`ci_db_verify_spec_W.md`) + 수동작업 게이트 컨벤션 신설.
- **활성(U)**: CI 게이트 정상화(`quality-check`+`db-verify` both required·`strict`) + main 브랜치 보호 + **lint blocking 승격**(선재 22건 정리) + 욕구사정 삭제=담당자 계약 초록화(#24). 실행노트 `docs/release/02`.
- **다음**: 지출↔분류축(`domain`/`subdomain`) UI 연결은 **W 백필 설계 확정 후** 착수(디자인 레인). GOAL축 A 잔여 화면은 W UX·easy-read 설계 후. copay 교차계층 계약 대기.
- **PRD 대조(U, 2026-08-28)**: 사용자 업로드 「서울형 리빌딩 PRD」 정합성 리뷰 완료 — `docs/release/03-prd-alignment-review.md`. 9장 그래프 시각화 등은 이미 구현·머지된 재발견, 가명처리·마스킹(7장)은 실제 공백으로 확인. W 판단 대기: ①가명처리 설계 착수 여부·우선순위 ②코디네이터 역할 세분화 여부 ③멀티테넌시 확장 가이드(GOAL축B3) 반영 여부.
- **U 병렬 오케스트레이션(U, 2026-09-04)**: U 축을 단일 직렬 세션 → **오케스트레이터 + worktree 격리 병렬 워커**로 승격(계정 한도 상향 활용). 저자(U)↔검증자(W) 분리·레인·PR/CI 불변, 병렬화는 저자(U) 내부 팬아웃뿐. 운영모델 `docs/release/04-u-parallel-orchestration.md` + 도구 `scripts/u-wave-plan.sh`([HANDOFF→U] PR을 파일겹침+STATE로 웨이브 편성, 이미구현/스펙 자동 스킵). 첫 실행: #83 P2토큰 → PR #89(green), #79·#80은 이미구현 판정으로 중복워커 중지. **U 구현큐 현재 비어있음** — W 신규 RED 계약 시 재편성 spawn.

- **스냅샷(2026-09-20) — 역사 기록**(아래 2026-09-27 스냅샷이 현행. 이 블록의 '진행 중(U)'는 #175 로 종료 — 단 OCR 결과 마스킹은 기관결정 선행이라 의도적 제외. 'P0 Manual-Ops' 중 감사 라이브적용은 2026-09-21 완료, 파기 스케줄은 미확인): 이후 대량 머지로 상태가 크게 바뀜.
  - **완료(재착수 금지)**: Track A 회계·거래장부·서류 6슬라이스(#131~#136) · P0-A 개인정보 처리방침 초안(#167) ·
    P0-B 통합 감사로그+열람감사+파기함수(#169) · 테스트 당사자 편집 예외(#168) · **관계망(Track B) 제거**
    (#171~#173, 코드·DB·설계 전면 종료, 라이브 드롭 PostgREST 검증) · P1~P7 프론트 재구성 완결(#89~#115).
  - **운영 모드**: **W 세션 진행 불가 → U 한 세션이 양축 대행**(구현≠검증은 신선 서브에이전트로 유지, main 머지는 사람).
    [[project_single-session-orchestration]].
  - **상위 방향(2026-09-19 사용자 /goal)**: 앱을 **3축 집중** 완성(당사자 자기주도 · 실무자 행정간소화/계획공유 ·
    관리자 파악/슈퍼비전). 온톨로지 성숙 전제 기능 보류.
  - **다음 우선순위**: `docs/release/14-prd-reprioritization.md`(PRD 재정합, 10-에이전트 실측). 03의 3대 실공백
    (가명처리·감사로그·Phase C) 전부 done. 남은 것 = **P0 개인정보 국외이전 법무 묶음**(OCR 원본+자유서술 국외전송+
    처리방침 발효/고지·동의, 기관결정 선행) · P0 Manual-Ops(감사 라이브적용·파기 스케줄) · P1 축C 감사무결성
    (`participant.preview` 배선)·가시성(`/admin/audit`)·축A 저비용 배선(EasyTerm·TTS)·인증 사람관문(당사자 실사용자 심사).
  - **진행 중(U)**: 결정 불필요 P0 코드 하드닝 착수 — OCR 결과 마스킹 · `easyReadSummary` term 커버리지 · `participant.preview` 감사 배선.
  - **copay 정정**: "교차계층 계약 대기"는 stale — DB `verify_06_copay` done, TS 패리티 테스트만 잔여(P3).

