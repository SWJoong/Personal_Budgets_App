---
name: harness-config-probes
description: .claude/harness.json·하네스 래퍼/훅 변경 검증법 — 종합 시 CI 재조회, 안전한 프로브, 레포 안 계약 부재, 문법오류 fail-open, case 글롭 구멍, 가드 우회 변형(절대경로·접미 agent_type·merge-ask 정규식·좌석 env), 설치본 vs 개발 사본, paths 스킬 미로드
metadata:
  type: reference
---

하네스 설정(`.claude/harness.json`)·`scripts/agent-sync.sh` 를 바꾸는 PR 에서 반복 확인할 것.

- **레포 안 계약 없음**: `npm test` 는 harness.json·agent-sync.sh 를 읽지 않는다. 플러그인 `lane-guard-selftest.sh` 는 **자체 픽스처 heredoc** 을 쓴다(레포 설정 아님). 따라서 harness.json 돌연변이는 CI·selftest 를 모두 통과한다 → 이 구조가 바뀌기 전까지 "계약 부재" 판정이 기본값.
- **프로브(읽기 전용)**: `printf '{"cwd":"<wt>","agent_type":"harness:u-worker","tool_input":{"file_path":"<p>"}}' | bash <plugin>/scripts/lane-guard.sh auto; echo $?` (2=차단, 0=허용). 좌석 접두 가드는 `AGENT_SYNC_REMOTE=bogus-no-such-remote bash <plugin>/scripts/agent-sync.sh post w "접두없음"`: 가드 작동 = exit 2 「거부」, 가드 해제 = exit 1 「채널이 없습니다」(가짜 remote 라 채널 쓰기 불가). **래퍼로 post 를 절대 돌리지 않는다**(돌연변이로 막았다고 믿어도 위험).
- **fail-open**: harness.json 이 문법 오류면 jq 오류가 삼켜져 lanes 가 일반 기본값으로 떨어진다(Plan&Source·skills·harness-plan·vitest.config·src/test/setup.ts·agent-sync.sh 편집 허용). seatPrefixes 가 비어 좌석 접두 가드도 건너뛴다.
- **case 글롭 의미론**: `src/**/*.test.ts` 는 슬래시가 하나 더 필요해 `src/x.test.ts`(src 바로 아래)를 못 잡는다. vitest(minimatch)는 그 파일을 테스트로 포함한다. 옛 레포 가드는 `src/*.test.ts` 로 전 깊이를 잡았다. 앞머리 `**/` 가 루트 파일을 잡는지는 플러그인 버전마다 다르다.
- **어느 사본이 실행되나**: 훅은 `~/.claude/plugins/cache/harness/harness/<ver>`(installed_plugins.json 의 installPath)를 실행한다. 레포 래퍼는 개발 사본 `~/문서/claude-harness/scripts` 를 먼저 찾는다. 개발 사본은 검증 도중에도 바뀐다. 재현 증거는 설치본 경로로 남기고, 두 사본의 `diff` 를 함께 적는다.

- **가드 우회 변형(설치본으로 프로브)**: lane-guard — 대상 worktree 에 harness.json 이 없으면 전부 허용(`hc_load || exit 0`), cwd=worktree 에서 메인 체크아웃 **절대경로**는 `hc_rel` 이 저장소 밖으로 판정해 허용(Edit/Write 입력은 절대경로라 상대경로 실측만으론 부족), agent_type 은 `${agent_type##*:}` 접미 비교라 `w-verifier`·`x:w-verifier` 가 전면 통과. merge-ask — `gh pr merge`·`git push … main` 리터럴 정규식이라 `/usr/bin/gh`·`"gh"`·`bash -c "…"`·`gh api …/merge`·`HEAD:refs/heads/main`·`+main`·`--all` 이 통과하고 `--admin=true` 는 차단이 아니라 ask(계정 admin + enforce_admins=false 와 묶어 본다). agent-sync — `AGENT_SYNC_SEAT=w` 면 좌석 접두 검사·`(via U)` 표식을 모두 건너뛰어 사람 자리 기록 위조 가능, 레포 래퍼는 플러그인이 없으면 post 도 exit 0.
- **인용 스크립트의 설치 여부**: 반박·증거가 플러그인 스크립트를 인용하면 `ls <installPath>/scripts` 로 설치본에 있는지 먼저 본다. 개발 사본에만 있는 스크립트(예: 0.2.0 의 pr-risk-tier·pr-merge-gate)를 근거로 기각된 finding 은 설치 런타임 기준으로 재평가한다.
- **roleSkills 로드**: frontmatter 에 `paths:` 가 있는 스킬(backend·frontend)은 에이전트 세션에서 해당 경로를 건드리기 전엔 목록에 없어 `Skill` → "Unknown skill" → 에이전트 지시("없으면 건너뛴다")대로 조용히 빠진다. 검증 시작 때 로드 결과를 확인·기록한다.

- **종합 단계 CI 상태는 재조회**: verify-pr 종합 입력의 CI 문자열(예: quality-check·db-verify pending)은 팬아웃 시작 시점 스냅샷이라 stale 일 수 있다. 판정 전 `gh pr checks N`·`gh pr view N --json headRefOid,mergeStateStatus` 로 다시 보고, head 가 입력과 같은지 함께 적는다.

**Why:** harness.json 을 정본으로 옮기면서 레포 안 lane selftest 가 지워졌다. 돌연변이 3종(레인 약화·문법 오류·래퍼 무력화)이 tsc·lint·test·플러그인 selftest 를 모두 통과했다.
**How to apply:** gate 티어 하네스 PR 은 위 프로브로 before/after 종료코드를 보이고, 수정안으로는 `src/test/` 에 harness.json 정적 계약을 두도록 제안한다(W 레인). [[stacked-pr-verification]] [[tier-glob-gaps]]
