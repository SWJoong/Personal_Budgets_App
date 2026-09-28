#!/usr/bin/env bash
# lane-guard-selftest.sh — scripts/lane-guard.sh 의 결정적 자기검증 (허용/차단/fail-open 기대값 대조)
# 사용법: bash scripts/lane-guard-selftest.sh   (저장소 어디서든; exit 0 = 전부 일치)
# 레인 패턴을 바꾸면 여기에 케이스를 추가한다 — "레인 = 코드 = 테스트" 1:1:1.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
here="$PWD"; pass=0; fail=0

t() { # t <role> <path> <expected-exit>
  local out rc
  out=$(printf '{"hook_event_name":"PreToolUse","tool_name":"Edit","cwd":"%s","tool_input":{"file_path":"%s"}}' "$here" "$2" \
        | bash scripts/lane-guard.sh "$1" 2>&1); rc=$?
  if [ "$rc" = "$3" ]; then pass=$((pass+1)); printf 'ok   %s %-48s exit=%s\n' "$1" "$2" "$rc"
  else fail=$((fail+1)); printf 'FAIL %s %-48s exit=%s (want %s)\n     %s\n' "$1" "$2" "$rc" "$3" "$out"; fi
}

echo "── u(구현 워커): W 레인·공유 파일 차단 ──"
t u src/test/tokenFoundation.test.ts 2
t u src/utils/copay.test.ts 2
t u src/app/actions/foo.spec.tsx 2
t u 'Plan&Source/goala_x_W.md' 2
t u supabase/seoul/verify_06_copay.sql 2
t u vitest.config.ts 2
t u .claude/skills/qa/SKILL.md 2
t u docs/harness-plan.md 2
t u CLAUDE.md 2
t u scripts/agent-sync.sh 2
t u .claude/agents/u-worker.md 2
t u "$here/src/test/setup.ts" 2
echo "── u: U 레인 허용 ──"
t u src/utils/copay.ts 0
t u supabase/seoul/21_new.sql 0
t u src/app/actions/receipts.ts 0
t u docs/release/17-x.md 0
t u next.config.ts 0
t u .github/workflows/ci.yml 0
echo "── u: 저장소 밖 허용 ──"
t u /tmp/scratch-notes.md 0
t u "$(dirname "$here")/outside.txt" 0
echo "── w(계약 저자): W 레인 허용 ──"
t w src/utils/copay.test.ts 0
t w 'Plan&Source/ontology/seoul/verify_new.sql' 0
t w src/test/newContract.test.ts 0
echo "── w: W 레인 밖·공유 차단 ──"
t w src/utils/copay.ts 2
t w supabase/seoul/21_new.sql 2
t w next.config.ts 2
t w CLAUDE.md 2
echo "── 특수 입력 ──"
printf '{"cwd":"%s","tool_input":{"notebook_path":"src/test/a.ipynb"}}' "$here" | bash scripts/lane-guard.sh u >/dev/null 2>&1; rc=$?
if [ "$rc" = 2 ]; then pass=$((pass+1)); echo "ok   u notebook_path(src/test) → 2"; else fail=$((fail+1)); echo "FAIL notebook_path rc=$rc"; fi
echo 'not json' | bash scripts/lane-guard.sh u >/dev/null 2>&1; rc=$?
if [ "$rc" = 0 ]; then pass=$((pass+1)); echo "ok   malformed json → 0 (fail-open)"; else fail=$((fail+1)); echo "FAIL malformed rc=$rc"; fi
echo '{}' | bash scripts/lane-guard.sh >/dev/null 2>&1; rc=$?
if [ "$rc" = 0 ]; then pass=$((pass+1)); echo "ok   role 없음 → 0"; else fail=$((fail+1)); echo "FAIL no-role rc=$rc"; fi
printf '{"cwd":"%s","tool_input":{"file_path":"src/test/x.test.ts"}}' "$here" | LANE_GUARD_DISABLE=1 bash scripts/lane-guard.sh u >/dev/null 2>&1; rc=$?
if [ "$rc" = 0 ]; then pass=$((pass+1)); echo "ok   LANE_GUARD_DISABLE=1 → 0"; else fail=$((fail+1)); echo "FAIL disable rc=$rc"; fi

echo "=== lane-guard selftest: pass=$pass fail=$fail ==="
[ "$fail" = 0 ]
