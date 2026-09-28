#!/usr/bin/env bash
# agent-sync.sh — 얇은 래퍼. 정본은 플러그인 `harness` 의 scripts/agent-sync.sh (설정: .claude/harness.json).
# 사용법은 정본과 같다:  scripts/agent-sync.sh pull | post <w|u> "메시지" | log [role]
# 플러그인 탐색 순서: HARNESS_DEV_DIR(명시한 개발 사본) → installed_plugins.json 의 installPath → 캐시(최신 버전) → 마켓플레이스 체크아웃.
# 플러그인이 없으면: pull 은 조용히 통과(exit 0, SessionStart 보호), post·log 는 설치 안내와 함께 exit 3(기록 유실을 성공으로 보고하지 않는다).
set -uo pipefail
cfg="$HOME/.claude"
cands=()
[ -n "${HARNESS_DEV_DIR:-}" ] && cands+=("$HARNESS_DEV_DIR/scripts")
if [ -f "$cfg/plugins/installed_plugins.json" ] && command -v jq >/dev/null 2>&1; then
  ip="$(jq -r '.plugins["harness@harness"][0].installPath // empty' "$cfg/plugins/installed_plugins.json" 2>/dev/null || true)"
  [ -n "$ip" ] && cands+=("$ip/scripts")
fi
latest="$(ls -d "$cfg"/plugins/cache/harness/harness/*/ 2>/dev/null | sort -V | tail -n1)"
[ -n "$latest" ] && cands+=("${latest%/}/scripts")
cands+=("$cfg/plugins/marketplaces/harness/scripts")
for d in "${cands[@]}"; do
  if [ -f "$d/agent-sync.sh" ]; then exec bash "$d/agent-sync.sh" "$@"; fi
done
case "${1:-}" in
  pull) exit 0 ;;
  *) echo "[agent-sync] 플러그인 harness 가 설치되어 있지 않아 '${1:-}' 를 수행하지 못했습니다 → gh auth setup-git && claude plugin marketplace add SWJoong/claude-harness && claude plugin install harness@harness" >&2; exit 3 ;;
esac
