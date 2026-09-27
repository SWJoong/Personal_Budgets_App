#!/usr/bin/env bash
# lane-guard.sh — 병렬 하네스 레인 가드 (Claude Code PreToolUse 훅)
# ------------------------------------------------------------------
# Edit/Write/MultiEdit/NotebookEdit 직전에 호출되어, 대상 파일이 호출 역할의 레인 밖이면
# exit 2 로 도구 호출을 차단한다(stderr 가 차단 사유로 에이전트에게 전달됨).
# 레인 정의는 CLAUDE.md 「레인 규칙」·docs/harness-plan.md §3 과 같다 — 여기가 "코드로 된 레인".
#
# 사용법(에이전트 프런트매터 hooks 명령):  bash scripts/lane-guard.sh <u|w>
#   u : 구현 워커(u-worker).          W 레인 파일 편집을 막는다.
#   w : 계약 저자(w-contract-author).  W 레인 **밖** 파일 편집을 막는다.
# 입력: stdin JSON {hook_event_name, tool_name, tool_input:{file_path|notebook_path}, cwd, ...}
# 정책: 저장소 밖 경로(스크래치·/tmp)는 허용. 입력 파싱 실패·jq 부재는 허용(fail-open) — 워커를 죽이지 않는다.
#       LANE_GUARD_DISABLE=1 이면 항상 허용(오케스트레이터 디버깅용).
# 한계: Bash 로 하는 파일 수정(sed -i, > 리다이렉트)은 이 훅이 보지 못한다 → 에이전트 본문의 금지 규율로 보완.
set -uo pipefail

role="${1:-}"
case "$role" in
  u|w) ;;
  *) echo "[lane-guard] usage: lane-guard.sh <u|w>" >&2; exit 0 ;;
esac
[ "${LANE_GUARD_DISABLE:-0}" = "1" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null || true)"
[ -n "$path" ] || exit 0
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
[ -n "$cwd" ] || cwd="$PWD"

case "$path" in /*) abs="$path" ;; *) abs="$cwd/$path" ;; esac
abs="$(realpath -m "$abs" 2>/dev/null || printf '%s' "$abs")"
root="$(cd "$cwd" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || exit 0
case "$abs" in "$root"/*) rel="${abs#"$root"/}" ;; *) exit 0 ;; esac   # 저장소 밖 → 허용

# ── W 레인(설계·검증) 패턴 — CLAUDE.md 「레인 규칙」과 1:1 ──────────────────────
is_w_lane() {
  case "$1" in
    'Plan&Source/'*)                 return 0 ;;   # 온톨로지·설계·검토보고서
    verify_*.sql|*/verify_*.sql)     return 0 ;;   # DB 계약 검증 SQL
    src/*.test.ts|src/*.test.tsx)    return 0 ;;   # co-located 테스트
    src/*.spec.ts|src/*.spec.tsx)    return 0 ;;
    src/test/*)                      return 0 ;;   # 테스트 셋업·정적 계약
    vitest.config.ts)                return 0 ;;
    .claude/skills/*)                return 0 ;;   # 역할 스킬
    docs/harness-plan.md)            return 0 ;;   # 하네스 정본
  esac
  return 1
}
# 공유·하네스 인프라: 양쪽 워커 모두 직접 편집 금지(오케스트레이터·사람이 편집)
is_shared() {
  case "$1" in
    CLAUDE.md|scripts/agent-sync.sh|scripts/lane-guard.sh|.claude/agents/*|.claude/workflows/*|.claude/settings.json) return 0 ;;
  esac
  return 1
}

deny() {
  printf '[lane-guard] 차단: %s\n  사유: %s\n  조치: 이 파일은 직접 고치지 말고 리포트의 LANE_NOTES/BLOCKER 로 올려라(레인 규칙: CLAUDE.md 「레인 규칙」).\n' "$rel" "$1" >&2
  exit 2
}

if is_shared "$rel"; then
  deny "공유·하네스 인프라 파일은 워커가 편집하지 않는다(오케스트레이터·사람 담당)"
fi
case "$role" in
  u) is_w_lane "$rel" && deny "W 레인(테스트·verify·설계·스킬) — 구현 워커는 계약을 초록으로만 만들고 수정·약화하지 않는다" ;;
  w) is_w_lane "$rel" || deny "W 레인 밖(구현 코드·빌드 SQL·CI·설정) — 계약 저자는 W 레인 파일만 쓴다" ;;
esac
exit 0
