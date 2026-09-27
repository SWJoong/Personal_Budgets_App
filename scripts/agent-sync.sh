#!/usr/bin/env bash
# agent-sync.sh — 얇은 래퍼. 정본은 플러그인 `harness` 의 scripts/agent-sync.sh (설정: .claude/harness.json).
# 플러그인 미설치 머신에서는 안내만 하고 통과한다(fail-safe). 사용법은 정본과 같다:
#   scripts/agent-sync.sh pull | post <w|u> "메시지" | log [role]
set -uo pipefail
for d in /home/choi/문서/claude-harness/scripts "$HOME"/.claude/plugins/cache/harness/harness/*/scripts "$HOME"/.claude/plugins/marketplaces/harness/scripts; do
  if [ -f "$d/agent-sync.sh" ]; then exec bash "$d/agent-sync.sh" "$@"; fi
done
echo "[agent-sync] 플러그인 harness 가 설치되어 있지 않습니다 → claude plugin marketplace add SWJoong/claude-harness && claude plugin install harness@harness" >&2
exit 0
