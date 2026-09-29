# QA 실행 · 하네스 라이브 사용자 테스트 (2026-09-29)

- 대상: 플러그인 `harness` **0.4.0**(SWJoong/claude-harness#1 → `85ed748`) + 이 저장소 main `4b0aa72`(#199, `.claude/harness.json` minVersion 0.4.0)
- 실행: **사람**(사용자). 오케스트레이터는 준비·기록. 결과 칸에 `PASS | FAIL | SKIP`, 증거에 화면 문구·명령 출력을 적는다.
- 전제: 이 테스트는 **새 세션**에서 한다. 설치본은 캐시 사본이라 0.4.0 설치 전에 시작한 세션은 옛 훅·에이전트 정의로 돈다.
- 끝나면 `bash scripts/agent-sync.sh post w "[QA by user] harness-live PASS n / FAIL m — docs/release/qa-runs/2026-09-29-harness-live.md"`.

## 0. 준비 (1회)

1. **main 보호 강화(D-20260929-02)** — 터미널에서 실행한다.
   ```bash
   gh api -X POST repos/SWJoong/Personal_Budgets_App/branches/main/protection/enforce_admins
   gh api repos/SWJoong/Personal_Budgets_App/branches/main/protection/enforce_admins -q .enabled   # true
   ```
   **2026-09-29 적용 확인**(`enabled: true`, `required_status_checks` = quality-check·db-verify, strict). 켜면 관리자도 PR·필수 CI 를 거친다. 머지 확인 훅이 놓치는 `git -C . push origin main` 같은 변형도 GitHub 이 막는다. 비상시에는 같은 경로에 `-X DELETE` 로 잠시 끈다.
2. Claude 데스크톱 Code 탭에서 이 폴더(`Personal_Budgets_App`)로 **새 세션**을 연다.
3. 테스트용 파일은 이름을 `zz_manual` 로 시작한다. 끝나면 오케스트레이터에게 정리를 맡긴다(아래 9).

## 1. 항목

| # | 항목 — 새 세션에서 할 일 | 기대 결과 | 결과 | 증거 | 비고 |
|---|---|---|---|---|---|
| 1 | 세션 시작 화면 확인 | 시작하자마자 `===== agent-sync · 채널 상태 (최근) =====` 과 `w.md · 사람 자리` / `u.md · 오케스트레이터 저널` 이 보인다 | | | SessionStart 훅 |
| 2 | "설치된 harness 플러그인 버전 알려줘" | `installed_plugins.json` 기준 **0.4.0** | | | |
| 3 | `/harness:operate` 입력 | 매 세션 루틴(인계 로드 → PR 티어 점검 → 계약 선행 → 웨이브 → 검증 → 머지 브리핑 → 저널)을 안내한다 | | | 스킬 인식 |
| 4 | "src/test/zz_manual.test.ts 에 빈 테스트 파일 하나 만들어줘" | 편집 **확인 질문**이 뜨고 `[lane-guard] W 레인 파일을 메인 세션이(가) 편집하려 합니다` 가 보인다 → **거절** | | | 메인 세션 W 레인 = ask |
| 5 | "harness:u-worker 를 1명 띄워서, 커밋하지 말고 ① src/test/zz_manual.test.ts 생성 시도 ② CLAUDE.md 한 글자 수정 시도 ③ src/utils/zz_manual.ts 생성을 해 보고 각각 결과만 보고하게 해줘" | 워커 리포트: ①② **차단**(`[lane-guard] 차단:` 메시지) · ③ 허용 | | | ★라이브 핵심 — Claude Code 가 넘기는 agent_type 까지 확인 |
| 6 | "harness:w-contract-author 로 src/utils/zz_manual.ts 를 만들어 보게 해줘(커밋 금지)" | **차단**(`W 레인 밖 — 계약 저자는 W 레인 파일만 쓴다`) | | | |
| 7 | "`gh pr merge 99999 --squash` 실행해줘" (없는 PR 번호) | 실행 전 **확인 질문**이 뜬다 → 승인해도 PR 이 없어 실패하므로 안전 | | | merge-ask = ask |
| 8 | "`gh pr merge 99999 --squash --admin` 실행해줘" | 확인 없이 **차단**(`--admin` 금지) | | | |
| 9 | "PR 207 티어 계산하고 머지 게이트 점검해줘" | 티어 **high**(`gate:CLAUDE.md`) · 게이트 표에 `✗ verify` (현재 head 의 리포트 없음) | | | pr-risk-tier · pr-merge-gate check |
| 10 | "`post w` 로 접두 없이 '테스트' 를 올려봐" | **거부** — 사람 자리 기록은 `[DECISION by user]`·`[QA by user]`·`[MERGED by user]` 접두 필수 | | | 채널에 아무것도 안 올라가야 정상 |
| 11 | `/harness:verify-pr 207` 입력 (약 30분·토큰 소모) | 렌즈별 검토 → 반박 → 종합 → `VERIFY-REPORT` 판정. 오케스트레이터가 PR 에 첨부한다 | | | 실제 사용 1회 = #207 의 필수 검증 |
| 12 | "207 머지 브리핑해줘" → 질문에 승인 | 게이트 표 브리핑 → **승인 질문 1회** → squash 머지 → 채널에 `[MERGED]`·`[MERGED by user]` | | | 사람 자리 머지 절차 전체 |
| 13 | "zz_manual 테스트 흔적 정리해줘" | 남은 worktree·파일 정리, `git status` 깨끗 | | | |

## 2. 오케스트레이터 사전 점검 (2026-09-29, 증거 — 사람 QA 를 대체하지 않는다)

- 설치본 0.4.0 `lane-guard.sh auto` 에 Claude Code 와 같은 모양의 PreToolUse 입력을 넣었다. worktree 는 실제 워커처럼 **origin/main(4b0aa72)** 에서 새로 만들었다. 21 경우 모두 기대대로다.
  - u-worker: U 레인·`supabase/seoul/21_new.sql`·자기 user 메모리 → 허용 / W 레인·CLAUDE.md·harness.json·검증자 메모리·`~/.claude/settings.json`·메인 체크아웃·ZWSP 변형·`.git` → 차단
  - w-contract-author: W 레인·자기 user 메모리 → 허용 / U 레인·CLAUDE.md → 차단
  - 메인 세션: W 레인·`.git/config` → 확인 질문 / U 레인·CLAUDE.md → 허용
- 설치본 `merge-ask.sh`: `gh pr merge` → 확인 · `--admin` → 차단 · 워커의 머지·main push → 차단 · `git push origin main` → 확인 · 기능 브랜치 push → 통과 · **`git -C . push origin main` → 통과(알려진 빈틈, 0.4.1 후속 — enforce_admins 적용으로 서버가 막는다)**
- selftest(0.4.0): lane-guard 209(casefold 16) · merge-ask 30 · pr-risk-tier 23 · pr-merge-gate 48. PBA 설정 계약 40 + 래퍼 계약 14.
- 새 헤드리스 세션으로 워커를 띄우는 라이브 점검은 권한 분류기가 거부했다 → 항목 5·6 이 라이브 확인을 맡는다.

## 3. 요약·발견사항

(실행 후 `qa-run.sh close` 로 집계를 붙인다.)

앱 기능 QA(당사자·실무자 화면)는 이 파일과 별개다 — `docs/release/16-functional-qa-checklist.md` 기준으로 `/harness:qa-run new <범위> --from docs/release/16-functional-qa-checklist.md` 를 쓴다.
