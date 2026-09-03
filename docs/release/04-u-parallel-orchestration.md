# 04 · U 병렬 오케스트레이션 운영 모델

> **한 줄**: U(구현·배포) 축을 **단일 직렬 세션 → U-오케스트레이터 + 병렬 워커(worktree 격리)** 로
> 승격한다. W(설계·검증) 축과의 **저자↔검증자 분리는 그대로 보존**한다. 병렬화는 *저자(U) 내부*에서만
> 팬아웃하며, 검증 경계는 건드리지 않는다.
>
> 계기: U 측 계정 한도 상향 → 준비된 W→U 핸드오프(RED 계약)가 여러 건 대기 중인데 직렬 U 세션이
> 병목. 남는 용량을 **동시 실행**으로 productively 소진한다.

관련: [`docs/harness-plan.md`](../harness-plan.md)(W 소유·하네스 정본) · 프로젝트 `CLAUDE.md` 「병렬 하네스」 ·
스킬 `parallel-agent-harness`(operating-model·adaptation-guide).

---

## 1. 무엇이 바뀌나 (Before → After)

| | Before (수동 2-머신) | After (U 병렬 오케스트레이션) |
|---|---|---|
| U 실행 | 사람이 Ubuntu 세션 1개를 직렬로 운전 | **U-오케스트레이터 세션 1** 이 **U-워커 N** 을 병렬 spawn·관리 |
| 처리량 | W→U 핸드오프를 1건씩 순차 소진 | 독립 핸드오프를 **동시** 소진(파일 겹치지 않는 만큼) |
| 충돌 방지 | 단일 트리라 자기 자신과 충돌 없음 | 각 워커가 **격리 worktree + 전용 브랜치 + 전용 파일셋** |
| W와의 관계 | W = 별도 세션(검증자) | **동일** — W는 그대로 독립 검증자, PR·CI로만 핸드오프 |
| 상태 채널 | `agent-sync`(w/u) | **동일** — 단, U측은 오케스트레이터가 **1건으로 취합** 후 post |

**바뀌지 않는 것(불변식)**: 레인 규칙, `agent-sync` 채널, `[HANDOFF→W]` 커밋 접두, main 브랜치 보호,
test-first(W가 RED 계약을 먼저 박고 U가 초록화). 이 문서는 *U 축을 어떻게 병렬로 굴리는가*만 정의한다.

---

## 2. 왜 분리가 깨지지 않는가 (핵심)

하네스의 존재 이유는 속도가 아니라 **자기 결과를 자기가 채점하지 않는 것**이다. 병렬화가 이 원리를
깨지 않는 이유:

- **모든 워커는 "저자(U)"** 다. 검증자(W)는 여전히 다른 세션이다. 워커를 늘려도 저자 쪽만 넓어진다.
- **워커는 테스트/검증을 작성하지 않는다.** W가 이미 박아 둔 RED 계약(`src/test/**`, `*.test.ts`,
  `Plan&Source/**/verify_*.sql`)을 **초록으로만** 만든다. 워커는 이 파일들을 **열어 읽되 수정 금지** —
  약화(weaken)는 곧 자기채점이므로 금지.
- **결정적 게이트가 먼저 거른다.** 값싼 테스트/verify(피드백·결정적)를 워커가 통과시킨 뒤에야, 비싼
  W 리뷰(피드백·추론적)가 병합 직전에 한 번 돈다. 순서 유지.

> 결론: 병렬화는 피드포워드(가이드)와 저자 실행만 확장한다. 피드백(검증) 경계는 불변.

---

## 3. 역할

### U-오케스트레이터 (이 관리 세션)
1. **분할(partition)**: 대기 중 W→U 핸드오프를 **파일이 겹치지 않는** 서브레인으로 쪼갠다. 겹치면
   같은 웨이브에 넣지 않는다(직렬화하거나 경계 재설계).
2. **spawn**: 각 서브레인마다 워커 1을 격리 worktree로 띄운다(§5 브리핑 계약).
3. **monitor**: 백그라운드 완료 알림을 받아 워커 리포트를 수집. (idle 폴링 금지 — 완료 시 자동 재호출.)
4. **aggregate & sync**: 웨이브 결과를 **1건**으로 취합해 `agent-sync post u` (채널 스팸 방지).
5. **guard**: 레인 침범·계약 약화·main push 시도를 사전 차단하고, 충돌 우선순위(§6)로 조정.
6. **wave 계획**: 다음 웨이브 착수/보류 결정(리스크·의존·용량 기준).

### U-워커 (서브에이전트, 격리 worktree)
- **입력**: 하나의 W 계약(설계 문서 + RED 테스트/verify) + 전용 파일셋 + 게이트.
- **출력**: 계약 초록 + 로컬 게이트 통과 + `feat/*` 브랜치 push + `[HANDOFF→W]` PR + 구조화 리포트.
- **금지**: 자기 파일셋 밖 편집, W-레인(테스트/verify/`Plan&Source`) 수정, main push, 계약 약화,
  `agent-sync` 직접 post(취합은 오케스트레이터). 막히면 **해킹 대신 BLOCKER 보고**.

### W (변경 없음)
- 별도 세션. 독립 검증(요구→타입→성능→보안→접근성→테스트)·easy-read·a11y → main merge.
- U 레인 파일 직접 수정 금지(기존 규칙 그대로).

---

## 4. 서브레인 규칙 (병렬 충돌 원천 차단)

충돌은 **두 워커가 같은 파일**을 만질 때만 난다. 그러니:

1. 웨이브 편성 전, 각 후보 핸드오프의 **변경 파일 집합**을 뽑는다:
   ```bash
   git fetch -q origin <w-계약-브랜치>
   git diff --name-only main...origin/<w-계약-브랜치>
   ```
2. 파일 집합이 **서로소(disjoint)** 인 것만 같은 웨이브에 넣는다. 교집합이 있으면 → 다른 웨이브로
   미루거나, 그 공유 파일의 담당 워커 1명만 지정.
3. 각 워커는 **격리 worktree**(별도 디렉터리)에서 돌아 파일시스템상 서로 안 보인다. 브랜치도 전용.
   → 웨이브 내 충돌은 구조적으로 0. 잔여 충돌은 **병합 시점(W)** 에서만, 레인 우선순위로 해소.

> `AdminSidebar.tsx`·`globals.css`·seoul build SQL·`actions/*` 처럼 **여러 기능이 공유하기 쉬운 파일**은
> 웨이브 편성 시 특히 교집합을 확인한다. 상습 교집합 = 모듈 경계 재설계 신호.

---

## 5. 워커 브리핑 계약 (spawn 시 반드시 포함)

서브에이전트는 컨텍스트가 백지이므로 브리핑이 **자기완결**이어야 한다. 필수 항목:

- **정체·규율**: "U 레인 구현 워커. 저자↔검증자 분리 하네스." + §3 금지 목록.
- **셋업**: W 계약 브랜치에서 전용 `feat/*` 분기 + `node_modules` 심볼릭 링크(속도):
  ```bash
  MAIN=/home/choi/문서/Personal_Budgets_App
  git fetch origin <w-계약-브랜치>
  git switch -c feat/<태스크> FETCH_HEAD
  [ -d node_modules ] || ln -s "$MAIN/node_modules" node_modules   # package.json 불변일 때만
  ```
- **태스크**: 설계 문서 경로 + RED 계약 경로 + **편집 허용 파일 화이트리스트**(그 밖은 금지).
- **게이트**: `npx vitest run <계약파일>` → `npm test` → `npm run build`(SQL이면 verify + build).
- **핸드오프**: commit(`[HANDOFF→W]`) → push → `gh pr create --base main`.
- **리턴**: `=== WORKER REPORT ===` 구조 블록(STATUS/BRANCH/PR/FILES/CONTRACT/GATE/LANE_NOTES/BLOCKER).

실행 수단: `Agent` 툴, `isolation: "worktree"`, `run_in_background: true`, `subagent_type: general-purpose`,
`model: sonnet`(계약이 정답을 조이므로 워커는 sonnet, 판단·조율은 오케스트레이터 모델).

---

## 6. 충돌·안전 우선순위

1. 워커 파일셋은 서로소로 편성(§4) → 웨이브 내 충돌 없음이 정상.
2. 병합 시점 충돌: **U 레인 → U 우선 / W 레인 → W 우선 / 공유 → 담당(U) 우선 / 판단 불가 → 사람**.
3. 안전장치(불변): main 직접 push 금지(브랜치 보호) · 워커의 테스트/verify 수정 금지 · 비가역·클라우드
   수동작업(대시보드 SQL·Auth·Storage)은 **자동화 금지**(수동 작업 게이트 — `CLAUDE.md` 참조).

---

## 7. 매 웨이브 루틴 (오케스트레이터)

1. `agent-sync.sh pull` — W 최신 상태.
2. 대기 W→U 핸드오프 나열 → 변경 파일셋 뽑아 **서로소 웨이브** 편성(§4).
3. 게이트 베이스라인 확인(main green 전제 — CI 보호).
4. 워커 N spawn(§5) — 한 메시지에서 동시 실행.
5. 완료 알림 수집 → 리포트 취합 → BLOCKER/레인노트 있으면 개입.
6. `agent-sync.sh post u "웨이브 결과 1건 취합 + 다음 요청"`.
7. 다음 웨이브 or W 검증 대기.

---

## 8. 교차 세션 확장 (선택)

같은 계정 내 다른 실 세션/원격 세션과의 조율이 필요하면 `ListAgents` → `SendMessage`로 상태를
주고받되, **코드 핸드오프는 여전히 PR·CI, 상태는 여전히 `agent-sync`** 다(채널 이원화 불변).
서브에이전트(웨이브 워커)는 오케스트레이터 관리 대상이고, 실 세션 조율은 그 위 레이어다.

---

## 부록 · 첫 웨이브 (기록)

W→U 대기 계약 중 파일셋이 서로소인 3건으로 첫 웨이브 편성:

| 워커 | W 계약 | 서브레인(파일) | 축 |
|---|---|---|---|
| P2 | #83 P2 토큰 토대 | `src/app/globals.css`, `(participant)/page.tsx` | frontend |
| ANON | #80 provider_domains anon | `supabase/seoul/11_provider_domains.sql` | backend |
| DOCS | #79 B2 서류함 | `documentShelf.ts`·`actions/document.ts`·`documents/{page,DocumentShelfClient}.tsx`·`AdminSidebar.tsx` | feature |

보류(웨이브 2 이후): #77 감사로그(다수 `actions/*` + `.github/workflows/db-verify.yml` 교집합·교차절단 →
단독 신중 처리), #78 라이프사이클 E2E(GREEN 회귀잠금 — 검증성).
