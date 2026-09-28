# 17 · 하네스 코드화 — 서브에이전트 정의 · 레인 가드 · 저장 워크플로

> **한 줄**: 2026-09-04 이후 U 세션이 즉석 브리핑으로 띄우던 워커·검증자를 **정의 파일**(`.claude/agents/`)로,
> 매번 다시 쓰던 독립 검증 팬아웃을 **저장 워크플로**(`/verify-pr`)로, 프롬프트 약속에만 기대던 레인 규율을
> **PreToolUse 훅**(`scripts/lane-guard.sh`)으로 옮긴다. 저자↔검증자 분리·PR/CI 게이트·agent-sync 채널은 불변.

관련: [`04-u-parallel-orchestration.md`](04-u-parallel-orchestration.md)(운영모델) ·
[`docs/harness-plan.md`](../harness-plan.md)(W 정본) · CLAUDE.md 「병렬 하네스」 · 스킬 `parallel-agent-harness`.

---

## 1. 왜 (2026-09-27 진단)

| 문제 | 비용 |
|---|---|
| 워커·검증자 정의 파일이 없어 spawn 마다 doc04 §5 브리핑을 산문으로 재작성 | 토큰 + 누락(첫 웨이브에서 이미 구현된 일에 워커를 붙인 사례) |
| 구현≠검증 분리가 "수정 금지" 문장에만 의존 | 워커가 계약을 약화해도 막을 장치가 없음 |
| 4관점+반박 검증을 매번 즉석 워크플로로 작성 | 절차 불일치 · 재개 불가 · 비용 비가시 |
| 역할 스킬이 미설치 라이브러리·OpenAI·pnpm·없는 참조 파일을 전제 | 매 턴 잘못된 전제가 컨텍스트에 로드 |
| SWJoong/harness(GitHub)와의 혼동 | 그 저장소는 Harness Open Source(구 Drone CI/CD) 포크로 이 하네스와 무관 |

Claude Code 의 병렬 수단 비교(문서 기준): 서브에이전트 = 한 세션 안의 워커(자기 컨텍스트, 요약 반환) /
워크플로(ultracode) = 스크립트가 다수 서브에이전트를 조율(중간 결과는 스크립트 변수, 같은 세션에서 재개) /
에이전트 팀 = 리드가 동료 세션들을 조율(실험 기능, worktree 격리 없음, 세션 재개 시 팀원 소실) /
지금의 W-U = 사람이 여는 독립 세션 2개 + git 채널. **이 프로젝트는 서브에이전트 + 저장 워크플로 조합을 택한다.**
에이전트 팀은 격리·재개·권한 프롬프트 집중 문제로 도입하지 않는다.

---

## 2. 무엇이 생겼나

### 2-1. 서브에이전트 정의 `.claude/agents/`

| 이름 | 축 | 모델 | 격리 | 도구 제한 | 선적재 스킬 | 훅 |
|---|---|---|---|---|---|---|
| `u-worker` | U 저자 | sonnet | worktree · background | — | backend · frontend | `lane-guard.sh u` — W 레인 Edit/Write 차단 |
| `w-verifier` | W 검증 | opus | 호출 시 지정 | Edit · Write · MultiEdit · NotebookEdit 불가 | qa · pl · easy-read-review | — |
| `w-contract-author` | W 계약 | opus | worktree · background | — | qa | `lane-guard.sh w` — W 레인 밖 차단 |

- 세 정의 모두 `memory: project`(`.claude/agent-memory/<name>/`, 커밋 가능)로 반복 함정을 축적한다.
- 호출: `Agent(subagent_type: "u-worker", prompt: "<태스크 · 화이트리스트 · 기준 브랜치>")`. 규율·게이트·리턴 형식은 정의에 내장.
- 리턴 형식: `=== WORKER REPORT ===` · `=== VERIFY REPORT ===` · `=== CONTRACT REPORT ===` (오케스트레이터가 그대로 취합).

### 2-2. 레인 가드 `scripts/lane-guard.sh <u|w>`

- PreToolUse(Edit|Write|MultiEdit|NotebookEdit) 훅. stdin JSON 의 `tool_input.file_path` 를 저장소 상대경로로 정규화해
  CLAUDE.md 「레인 규칙」과 1:1 인 패턴으로 판정한다. 위반이면 exit 2 + 사유(stderr) → 에이전트에 전달, 도구 호출 취소.
- 공유·인프라 파일(`CLAUDE.md` · `scripts/*` · `.claude/agents|workflows` · `settings.json`)은 양쪽 워커 모두 차단(오케스트레이터·사람 담당).
- fail-open: 저장소 밖 경로·JSON 파싱 실패·jq 부재는 허용. `LANE_GUARD_DISABLE=1` 로 끌 수 있다.
- **한계**: Bash 로 하는 파일 수정(`sed -i` · 리다이렉트)은 보지 못한다 → 에이전트 본문에서 금지. 프로젝트 서브에이전트의
  프런트매터 훅은 폴더를 trust 한 뒤에만 실행된다(문서 기준 v2.1.218+).
- 검증: `scripts/lane-guard-selftest.sh` 31 케이스(차단 17 · 허용 11 · fail-open/우회 3) 전부 기대값 일치 — §5. 레인 패턴을 바꾸면 케이스를 같이 고친다(레인 = 코드 = 테스트).

### 2-3. 저장 워크플로 `.claude/workflows/verify-pr.js` → `/verify-pr <PR번호>`

```
범위(1, effort low) → 검토 4렌즈(w-verifier) ─┬→ 반박 2명/렌즈(w-verifier) → 집계 → 종합(1, w-verifier)
                                              └ 렌즈별 파이프라인: 끝난 렌즈부터 반박 시작
```
- 렌즈: 요구·타입 / 보안·RLS / 접근성·쉬운말(당사자 문구 변경 시만 easy-read) / 테스트·돌연변이(격리 worktree, 원복 필수).
- 생존 규칙: 치명·높음은 반박자 1명이라도 확인하면 생존, 보통·낮음은 2명 모두 확인해야 생존. 반박자 실패 시 "미검증" 으로 보존.
- 리턴: `{pr, verdict, confirmed, rejected, report}`. report 는 `=== VERIFY REPORT ===` 형식.
- 에이전트 수 최대 14(1+4+8+1). 같은 세션에서 run id 로 재개 가능. 실행은 사용자가 `/verify-pr N` 을 호출해 시작한다(워크플로 옵트인).

### 2-4. 역할 스킬 정정 (`.claude/skills/` — W 레인, 2026-09-04 단일세션 지시로 편집)

| 스킬 | 정정 |
|---|---|
| frontend | 없는 `references/fe-patterns.md` 참조 제거 → CLAUDE.md·tech-stack.md. 미설치 TanStack Query·Zustand·RHF·Zod 전제 삭제 → 서버 액션 + `useTransition` · 네이티브 폼 관례. `features/` → 실제 `src/components/<영역>`. `paths:` 추가 |
| backend | `supabase/migrations/` → `supabase/seoul/` 빌드 SQL + Manual-Ops. OpenAI → Claude(`src/utils/ai.ts`) + 마스킹. Edge Function → 서버 액션. 구 테이블표 → 정본 포인터. `data-models.md` 에 구 스키마 배너. `paths:` 추가 |
| devops | pnpm → npm. 현행 ci.yml · db-verify · 브랜치 보호 반영. 없는 develop/스테이징·Slack 제거. Manual-Ops 게이트. `paths:` 추가 |
| pl · tech-stack | 없는 `coding-standards.md` 참조 → tech-stack 컨벤션 + 하네스 접두. 상태관리·폼·pnpm·Prettier·Playwright·폴더 구조·브랜치 전략 현행화 |
| qa | MSW·Playwright·axe 미도입 반영 → Testing Library 렌더 계약 · DB 계약 · 수동 QA 체크리스트 · jsx-a11y |
| README | 스킬 ↔ 에이전트 ↔ 워크플로 층 설명 |

---

## 3. 운영 방법 (오케스트레이터 루틴 갱신)

1. `agent-sync.sh pull` → `u-wave-plan.sh` 로 RED 웨이브 편성(불변).
2. 워커: `Agent(subagent_type: "u-worker")` × N (한 메시지에서 동시). 브리핑 = 태스크 · 화이트리스트 · 기준 브랜치.
3. 계약 선행이 필요하면 `Agent(subagent_type: "w-contract-author")` 로 RED 계약 PR 을 먼저 만든다.
4. PR 이 오면 `/verify-pr <N>` (또는 단건 `Agent(subagent_type: "w-verifier")`). 저자 세션이 직접 approve 하지 않는다.
5. 결과 취합 → `agent-sync.sh post u` 1건. 머지는 사람.

새 정의·워크플로는 **새 세션(또는 `/reload-skills`)** 에서 인식된다.

---

## 4. 비용·모델 배치

- 워커 sonnet(계약이 정답을 조인다) / 검증·계약 opus / 범위 수집 effort low.
- 팬아웃 캐시: 서브에이전트 프롬프트 캐시 TTL 기본 5분 → 10+ 에이전트 검증에서 손실 가능.
  `subagentPromptCacheTtl: "1h"` 검토(API 과금이면 1h 쓰기 단가↑, 구독은 사용량 한도 기준). 이번 PR 에서는 설정하지 않았다.
- `workflowSizeGuideline` 은 Claude 가 즉석 작성할 때의 지침이라 저장 워크플로에는 무관.

---

## 5. 검증 기록

- `bash scripts/lane-guard-selftest.sh` → pass=31 fail=0 (차단 17 · 허용 11 · fail-open/우회 3).
- `npm test` → 155 파일 · 1056 테스트 통과(src 변경 없음, 회귀 0 확인용).
- `verify-pr.js`: meta·본문 `node --check` 통과, `meta.phases` 4개 = `phase()` 제목과 일치.
- 서브에이전트 프런트매터 필드는 sub-agents 문서와 대조: name · description · model · isolation · background · skills ·
  memory · color · disallowedTools · hooks.
- 라이브 spawn 테스트는 머지 후 새 세션에서(정의 인식 시점) — §6.

---

## 6. 남은 일 (후속)

- [ ] 새 세션에서 `u-worker` 라이브 spawn 1건으로 훅 차단 메시지·리턴 형식 실증.
- [ ] `u-wave` 저장 워크플로: `u-wave-plan.sh` 출력 → 서로소 웨이브 → `u-worker` 동시 spawn.
- [ ] 홈 `~/.claude/CLAUDE.md` U 지시서 「W 레인 열지도 말 것」을 단일세션 운영모드(검증=신선 서브에이전트, 머지=사람)로 갱신(사용자 파일).
- [ ] agent-sync 브랜치 push 의 Vercel 빌드 노이즈 → Ignored Build Step(W 제안, 처리 여부 확인).
- [ ] W 복귀 시: Remote Control 교차세션 메시징을 라이브 보조 채널로(정본은 여전히 agent-sync).
