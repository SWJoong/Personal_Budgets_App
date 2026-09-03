#!/usr/bin/env bash
# u-wave-plan.sh — U 오케스트레이터의 웨이브 편성 도우미
# ------------------------------------------------------------------
# W→U 대기 핸드오프([HANDOFF→U] 오픈 PR)의 변경 파일셋을 뽑아, 파일이 겹치는 쌍을 검출하고
# "서로소(disjoint) 파일셋" 그룹 = 안전하게 동시 실행 가능한 웨이브를 그리디로 제안한다.
# docs/release/04-u-parallel-orchestration.md §4(서브레인)·§7(매 웨이브 루틴)을 도구화한 것.
#
# 사용법:
#   scripts/u-wave-plan.sh                # HANDOFF→U 오픈 PR 자동 수집 후 웨이브 제안
#   scripts/u-wave-plan.sh b1 b2 b3       # 지정한 브랜치들만으로 편성(오프라인·수동)
#   BASE=main scripts/u-wave-plan.sh      # 비교 기준 브랜치 변경(기본 main)
#
# 요구: git (+ 자동수집엔 gh). 코드/작업트리는 절대 건드리지 않는다(읽기 전용).
set -euo pipefail

BASE="${BASE:-main}"
REMOTE="${U_WAVE_REMOTE:-origin}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "[u-wave-plan] git 저장소가 아닙니다."; exit 1; }
cd "$ROOT"

git fetch -q "$REMOTE" "$BASE" 2>/dev/null || true

# ── 1) 대상 브랜치 수집 ────────────────────────────────────────────────
branches=()
if [ "$#" -gt 0 ]; then
  branches=("$@")
else
  if ! command -v gh >/dev/null 2>&1; then
    echo "[u-wave-plan] gh 없음 → 브랜치를 인자로 넘기세요: u-wave-plan.sh <b1> <b2> ..."
    exit 2
  fi
  # 제목에 HANDOFF→U 가 있는 오픈 PR의 head 브랜치
  while IFS=$'\t' read -r num title head; do
    case "$title" in *"HANDOFF→U"*) branches+=("$head"); printf '  PR #%s  %s\n' "$num" "$head" ;; esac
  done < <(gh pr list --state open --limit 50 --json number,title,headRefName \
             --jq '.[] | "\(.number)\t\(.title)\t\(.headRefName)"' 2>/dev/null)
  echo "─────────────────────────────────────────────"
fi

n=${#branches[@]}
[ "$n" -gt 0 ] || { echo "[u-wave-plan] 대상 핸드오프가 없습니다."; exit 0; }

# ── 2) 각 브랜치의 변경 파일셋 + STATE 분류 ────────────────────────────
# STATE: 왜 필요한가 — [HANDOFF→U] PR이라도 (a) 코드 없는 순수 스펙이거나 (b) 이미 U가
# 구현해 둔 브랜치일 수 있다. 이걸 거르지 않으면 워커가 이미 끝난 일을 다시 한다(실제 발생함).
#   스펙(코드0)        : 변경 파일이 전부 Plan&Source/** (설계·verify) → U 구현 대상 아님, 스킵.
#   U구현있음(검증대기) : 커밋에 [U] 또는 feat( 존재 → 이미 구현됨, W 검증 대기, 스킵.
#   RED(구현대기)      : W 계약(test/docs+HANDOFF→U)만 있고 코드 미구현 → ★워커 spawn 대상.
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
declare -a STATE
for i in "${!branches[@]}"; do
  b="${branches[$i]}"
  git fetch -q "$REMOTE" "$b" 2>/dev/null || true
  ref="$REMOTE/$b"; git rev-parse -q --verify "$ref" >/dev/null 2>&1 || ref="$b"
  git diff --name-only "$BASE...$ref" 2>/dev/null | sort -u > "$tmp/$i.files" || : > "$tmp/$i.files"
  cnt=$(wc -l < "$tmp/$i.files")
  code_files=$(grep -vcE '^Plan&Source/' "$tmp/$i.files" || true)
  subjects="$(git log --format='%s' "$BASE..$ref" 2>/dev/null || true)"
  if [ "${code_files:-0}" -eq 0 ]; then
    STATE[$i]="스펙(코드0·스킵)"
  elif printf '%s' "$subjects" | grep -qE '\[U\]|^feat\('; then
    STATE[$i]="U구현있음(검증대기·스킵)"
  else
    STATE[$i]="RED(U 구현대기)★"
  fi
  printf '[%d] %-42s  파일 %s개(코드 %s)  %s\n' "$i" "$b" "$cnt" "${code_files:-0}" "${STATE[$i]}"
done

# ── 3) pairwise 파일 교집합 ────────────────────────────────────────────
echo; echo "=== 파일 교집합(겹치면 같은 웨이브 금지) ==="
overlap_any=0
declare -A CONFLICT
for ((a=0; a<n; a++)); do
  for ((b=a+1; b<n; b++)); do
    inter=$(comm -12 "$tmp/$a.files" "$tmp/$b.files")
    if [ -n "$inter" ]; then
      overlap_any=1; CONFLICT["$a,$b"]=1; CONFLICT["$b,$a"]=1
      echo "  [$a]×[$b] ${branches[$a]} ∩ ${branches[$b]}:"
      echo "$inter" | sed 's/^/      /'
    fi
  done
done
[ "$overlap_any" = 0 ] && echo "  (교집합 없음 — 전부 한 웨이브로 동시 실행 가능)"

# ── 4) 그리디 웨이브 편성 — RED(구현대기)만 대상, 파일셋 서로소 그룹 ────
echo; echo "=== 제안 웨이브(RED 구현대기만 · 웨이브 내 파일셋 서로소) ==="
declare -a WAVE_OF
todo=0
for ((i=0;i<n;i++)); do
  case "${STATE[$i]}" in
    "RED(U 구현대기)★") WAVE_OF[$i]=-1; todo=$((todo+1)) ;;
    *) WAVE_OF[$i]=-2 ;;   # 스킵(스펙·이미 구현)
  esac
done
if [ "$todo" -eq 0 ]; then
  echo "  (구현대기 핸드오프 없음 — spawn 불필요. 나머지는 검증/스펙.)"
else
  wave=0
  for ((i=0;i<n;i++)); do
    [ "${WAVE_OF[$i]}" -ne -1 ] && continue
    wave=$((wave+1)); WAVE_OF[$i]=$wave
    members=("$i")
    for ((j=i+1;j<n;j++)); do
      [ "${WAVE_OF[$j]}" -ne -1 ] && continue
      ok=1
      for m in "${members[@]}"; do [ -n "${CONFLICT[$m,$j]:-}" ] && { ok=0; break; }; done
      [ "$ok" = 1 ] && { WAVE_OF[$j]=$wave; members+=("$j"); }
    done
    printf ' 웨이브 %d:' "$wave"
    for m in "${members[@]}"; do printf ' %s' "${branches[$m]}"; done
    echo
  done
fi
echo; echo "=== 스킵(워커 불필요) ==="
skipped=0
for ((i=0;i<n;i++)); do
  [ "${WAVE_OF[$i]}" = "-2" ] && { printf '  · %-42s %s\n' "${branches[$i]}" "${STATE[$i]}"; skipped=1; }
done
[ "$skipped" = 0 ] && echo "  (없음)"
echo; echo "→ RED 웨이브를 Agent(isolation:worktree, background)로 동시 spawn. docs/release/04 §5 브리핑 계약."
