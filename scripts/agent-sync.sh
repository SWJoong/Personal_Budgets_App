#!/usr/bin/env bash
# 병렬 에이전트 상태 동기화 채널 (agent-sync)
# ------------------------------------------------------------------
# 여러 Claude 인스턴스가 사람의 복붙 없이 "무엇을 했고 다음에 뭘 해달라"는 상태만 주고받게 한다.
# 전용 채널 브랜치(기본 'agent-sync')를 메시지 보드로 쓰며, main·작업 브랜치의 워킹트리는
# 절대 건드리지 않는다(임시 worktree로 채널 브랜치만 갱신). 코드 핸드오프는 이 채널이 아니라
# 여전히 PR·CI로 한다 — 채널은 대화(상태)만 나른다.
#
# 사용법:
#   agent-sync.sh pull                 # 모든 역할의 최신 상태 출력 — 세션 시작/재개 시
#   agent-sync.sh post <role> "메시지"  # 내 상태를 채널에 기록·푸시 — 핸드오프·턴 종료 시
#   agent-sync.sh log [role]           # 채널 전체 로그 출력(역할 지정 가능)
#
# 요구: bash + git. 오프라인이면 조용히 통과(fail-safe)해 세션을 막지 않는다.
#
# ── 프로젝트에 맞게 고치는 곳 (아래 4줄이 전부) ──────────────────────────────
#   ROLES : 역할 id 목록(공백 구분). 두 에이전트면 "w u", 이름을 바꿔도 됨("a b", "plan impl verify").
#   EMAIL : 채널 커밋 작성자 이메일. 기본은 git config user.email 자동 사용.
#   BRANCH/REMOTE : 채널 브랜치·리모트 이름. 보통 그대로 둔다.
#   전부 환경변수로도 덮어쓸 수 있다(AGENT_SYNC_ROLES 등).
# ---------------------------------------------------------------------------
set -euo pipefail

BRANCH="${AGENT_SYNC_BRANCH:-agent-sync}"
REMOTE="${AGENT_SYNC_REMOTE:-origin}"
ROLES="${AGENT_SYNC_ROLES:-w u}"
EMAIL="${AGENT_SYNC_EMAIL:-$(git config user.email 2>/dev/null || echo agent@localhost)}"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "[agent-sync] git 저장소가 아닙니다."; exit 0; }
cd "$ROOT"

_is_role() { case " $ROLES " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }
_have_channel() { git show-ref --verify -q "refs/remotes/$REMOTE/$BRANCH"; }
_fetch() { git fetch -q "$REMOTE" "$BRANCH" 2>/dev/null || true; }

cmd_pull() {
  _fetch
  if ! _have_channel; then
    echo "[agent-sync] 채널이 아직 없습니다. 한쪽이 첫 post를 하면 생성됩니다(부트스트랩은 SKILL.md 참조)."
    return 0
  fi
  echo "===== agent-sync · 상대 상태 (최근) ====="
  local role
  for role in $ROLES; do
    if git cat-file -e "$REMOTE/$BRANCH:$role.md" 2>/dev/null; then
      echo "----- ${role}.md -----"
      git show "$REMOTE/$BRANCH:$role.md" | tail -n 24
      echo
    fi
  done
}

cmd_log() {
  _fetch
  _have_channel || { echo "[agent-sync] 채널 없음."; return 0; }
  local role="${1:-}"
  if [ -n "$role" ]; then
    git show "$REMOTE/$BRANCH:${role}.md" 2>/dev/null || echo "(${role}.md 없음)"
  else
    for role in $ROLES; do
      echo "===== ${role} ====="
      git show "$REMOTE/$BRANCH:${role}.md" 2>/dev/null || true
    done
  fi
}

cmd_post() {
  local role="${1:-}"; shift || true
  local msg="${*:-}"
  _is_role "$role" || { echo "역할은 다음 중 하나여야 합니다: $ROLES"; exit 2; }
  [ -n "$msg" ] || { echo "메시지가 비었습니다."; exit 2; }

  _fetch
  _have_channel || { echo "[agent-sync] 채널이 없습니다. 부트스트랩을 먼저 실행하세요(SKILL.md '채널 만들기')."; exit 1; }

  local ts up tmp wt
  ts="$(date -u +%Y-%m-%dT%H:%MZ)"
  up="$(printf '%s' "$role" | tr '[:lower:]' '[:upper:]')"
  tmp="$(mktemp -d)"; wt="$tmp/wt"   # worktree add는 대상 경로가 없어야 하므로 하위 경로 사용

  git worktree add -q --detach "$wt" "$REMOTE/$BRANCH"
  printf '## [%s] %s\n%s\n\n' "$ts" "$up" "$msg" >> "$wt/${role}.md"
  (
    cd "$wt"
    git add "${role}.md"
    git -c user.name="agent [$up]" -c user.email="$EMAIL" commit -q -m "sync(${role}): ${ts}"
    # 동시 push 충돌 대비 최대 3회 재시도(rebase 후)
    pushed=0
    for i in 1 2 3; do
      if git push -q "$REMOTE" "HEAD:$BRANCH"; then pushed=1; break; fi
      git fetch -q "$REMOTE" "$BRANCH" && git rebase -q "$REMOTE/$BRANCH" || true
      sleep 1
    done
    [ "$pushed" = 1 ] || echo "[agent-sync] 경고: push 실패(오프라인?). 로컬 커밋만 남았습니다." >&2
  )
  git worktree remove --force "$wt"
  rm -rf "$tmp"
  echo "[agent-sync] posted (${role} @ ${ts})"
}

case "${1:-}" in
  pull) cmd_pull ;;
  post) shift; cmd_post "$@" ;;
  log)  shift; cmd_log "${1:-}" ;;
  *) echo "usage: agent-sync.sh {pull | post <role> \"메시지\" | log [role]}  (roles: $ROLES)"; exit 2 ;;
esac
