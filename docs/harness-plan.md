# 병렬 에이전트 하네스 운영 계획 — 개인예산제 앱 (v2 · 단일 계정 · W/U = 역할)

> 한 계정의 **오케스트레이터 세션(U)** 이 서브에이전트로 **W(설계·검증)·U(구현·배포) 역할 컨텍스트**를 분리 실행한다.
> 규칙 정본 = `CLAUDE.md` 「병렬 하네스」 + `.claude/harness.json` · 런타임 = 플러그인 `harness` · 이 문서 = 근거·절차·이력.
> 상태: **v2 (2026-09-27)** — v1 FINAL(2026-08-19, 2계정 W·U 수렴 모델)은 §10 전환 기록으로 남긴다.
> 원본 하네스 스킬 `parallel-agent-harness`(EASYREAD 유래) → 플러그인 `harness`(`/harness:install`·`/harness:operate`)로 승계.

---

## 1. 왜 분리인가 (버리지 말 것)

핵심은 속도가 아니라 **자기 결과를 자기가 채점하지 않게 하는 것**이다.
- 계약(테스트·verify SQL)을 쓰는 컨텍스트, 구현하는 컨텍스트, 검증하는 컨텍스트를 **서로 다른 서브에이전트**에 둔다 → 확증편향·자기채점 방지.
- 각 컨텍스트는 자기 레인에만 토큰을 쓰고, 상태는 채널(agent-sync)로 나른다 → 협업 토큰 비용↓.
- 계정이 둘일 필요는 없다. 분리는 **컨텍스트 경계 + 도구 권한(훅)** 으로 만든다.

---

## 2. 역할 구성 (컨텍스트 = 실행 주체)

| 역할 | 실행 주체 | 축 | 역할 스킬(`roleSkills`) | 레인 |
|---|---|---|---|---|
| 오케스트레이터 | U 세션 메인 컨텍스트(사용자와 대화) | 조율 | 설계·계획은 `/ux-ui` `/pm` `/pl` 을 사용자와 함께 | 공유·인프라·`docs/release/` + 소규모 예외 |
| `harness:u-worker` | 서브에이전트(sonnet · worktree · background) | 구현·배포 | backend · frontend | U 레인 |
| `harness:w-contract-author` | 서브에이전트(opus · worktree · background) | 설계·계약 | qa · pl · easy-read-review(`roleSkills.w` 공유) | W 레인 |
| `harness:w-verifier` · `/harness:verify-pr` | 서브에이전트(opus · Edit/Write 불가) | 검증 | qa · pl · easy-read-review | 없음(리포트만) |
| **사람 자리(W)** | 사용자 — 어느 세션·머신에서든 | QA · 머지 · 결정 | — | 전부(권위) |

- 에이전트는 시작 시 `.claude/harness.json` 의 `roleSkills` 를 Skill 도구로 로드한다(`/devops` 는 오케스트레이터가 CI·배포 문서 작업에 직접).
- 핵심 규칙: **같은 기능의 구현과 계약을 한 컨텍스트가 함께 쓰지 않는다.** 오케스트레이터가 구현을 직접 썼다면 그 기능의 계약·검증은 반드시 위임한다.

---

## 3. 레인 (충돌 방지) — 정본 `.claude/harness.json`

- **어디를 보나**: 레인 목록 요약 = `CLAUDE.md` 「레인 규칙」, 판정 정본 = `.claude/harness.json` `lanes`. 이 문서는 글롭을 다시 나열하지 않는다
  — 요약이 둘이면 한쪽이 조용히 낡는다(#199 재검증에서 이 절의 공유 목록이 5개로 멈춰 있던 사례). 설정 계약은 CLAUDE.md 요약만 대조한다.
- **세 레인의 뜻**: W = 계약·검증·설계(`harness:w-contract-author` 컨텍스트만 — 오케스트레이터는 소규모 예외(경로·주석·오타·현황)만 직접, 플러그인 훅이 확인을 묻는다) ·
  U = 그 밖의 구현·빌드 SQL·빌드설정·릴리스 문서(`harness:u-worker`) · 공유·인프라 = 하네스 규칙·설정·기록·에이전트 메모리(오케스트레이터·사람만, 양쪽 워커 훅 차단).
- 이 repo 특이점: 테스트가 `src/` 에 co-located 라 **파일 접미사**(`.test`·`.spec`)로 가른다(vitest include 와 같은 규칙).
- 패턴은 플러그인 `scripts/lane-guard.sh` 가 강제하고, 플러그인 selftest(픽스처)와 **이 저장소의 정적 계약 `src/test/harnessConfig.test.ts`**(W 레인, `harness:w-contract-author` 저작 — harness.json 파싱·필수 레인/티어/채널/게이트 값·CLAUDE.md 요약과의 양방향 정합·군별 대표 경로·SQL 정책 정규식 샘플)가 대조한다(레인 = 코드 = 테스트).

---

## 4. Git 워크플로

```
main ─────────────────────────────────────► (항상 그린 · 브랜치 보호: quality-check + db-verify required, strict)
  ├── test/w-* 계약 PR([HANDOFF→U], draft) ─┐   harness:w-contract-author
  └── feat/* 구현 PR([HANDOFF→W]) ◄─────────┘   harness:u-worker → 티어별 검증 → 사람 승인 1회 → squash 머지(어느 세션에서든)
```
- 코드 핸드오프는 PR·CI 로만. main 직접 push 금지(플러그인 훅이 `gh pr merge`·main push 를 다시 묻는다).
- strict 보호라 BEHIND 면 update-branch → CI 재green → 머지. 계약 PR 은 단독 머지하지 않고 구현 PR 에 스택, 머지 후 닫는다.

---

## 5. 작업 흐름 (test-first)

| 순서 | 컨텍스트 | 작업 |
|---|---|---|
| 1 | `harness:w-contract-author` | 실패하는 골든/계약 테스트 · verify SQL 로 동작을 못 박음(RED · 그린어빌리티 · tsc 확인) |
| 2 | `harness:u-worker` | 계약을 초록으로 만드는 구현 · 빌드 SQL(격리 worktree · 편집 화이트리스트) |
| 3 | `harness:w-verifier` / `/harness:verify-pr` | 티어별 독립 검증 리포트(돌연변이 확인 포함) → PR 코멘트 |
| 4 | 사람 자리 | 브리핑 → 승인 1회 → 머지 |

- test-first 필수 범위: 순수 로직(`src/utils`) · 서버 액션 · DB 계약. UI 문구·docs 는 선택.
- 규칙 = 파일 = 테스트 **1:1:1** → 실패 지점 즉시 특정.

---

## 6. 결정 규약 (v1 수렴 프로토콜 폐기)

- 결정 질문은 **오케스트레이터만** 한다(AskUserQuestion, 옵션 프레이밍). 서브에이전트·워크플로는 묻지 않고 플래그만.
- 결정은 3곳에 기록: CLAUDE.md 「현재 작업 현황」 결정 확정 줄 · `docs/release/decisions.md` 행(D-YYYYMMDD-nn) · `agent-sync.sh post w "[DECISION by user] …"`.
- v1 의 `STATUS: PROPOSE/AGREE/FINAL` · 6라운드 에스컬레이션은 상대 세션이 없으므로 폐기.

---

## 7. 상태 동기화 — agent-sync (저널 + 사람 자리 기록)

- `u.md` = 오케스트레이터 저널·다음 세션 인계문(턴 종료·웨이브 취합 1건). `w.md` = 사람 자리 기록(QA·머지·결정) — 어느 머신에서든 `post w`,
  U 세션이 대신 올리면 `[DECISION by user]`·`[QA by user]`·`[MERGED by user]` 접두 필수 + 헤더 "(via U)".
- 세션 시작 시 플러그인 훅이 `pull`. 채널엔 상태만, 코드는 PR·CI.

---

## 8. 검증 티어 — 정본 `.claude/harness.json` `tiers`

- **어디를 보나**: 티어 요약(조건·검증·머지) = `CLAUDE.md` 「검증 티어」, 판정 정본 = `.claude/harness.json` `tiers`(플러그인 `pr-risk-tier.sh` 가 계산).
  이 문서는 경로군·임계·정규식을 다시 적지 않는다 — §3 과 같은 이유(요약 이중화 = 드리프트, #199 재검증에서 이 표의 storage 군 누락 사례).
- **세 티어의 뜻**: docs = 문서만 바뀜(CI + 사람 읽기) · small = 고위험이 아닌 코드(`harness:w-verifier` 1건, 돌연변이 포함) ·
  high = 고위험 경로군·SQL 정책 diff·대형·당사자 문구 중 하나라도(`/harness:verify-pr N`, 재검증은 `--lens`).
- 티어는 PR 본문 `- 검증 티어:` 에 선언하고 게이트가 선언·계산 중 높은 쪽을 적용한다. **계산 티어 아래로 내리는 수단은 없다** — 계산이 과하면
  `.claude/harness.json` `tiers` 를 고치는 PR(gate 티어)로 조정한다(채널·결정 로그 기록으로는 내려가지 않는다).
- 계약 PR(`[HANDOFF→U]`)은 티어 대상이 아니다.
- src 를 바꾸지 않는 설정 PR 은 돌연변이 검증 대신 설정 계약 `src/test/harnessConfig.test.ts`(§3)로 조인다.

---

## 9. 로드맵 (콘텐츠 레이어 — v1 §8 승계, 역사)

> W/U 라벨은 역할이다. GOAL축 A(서울형 앱)·B(온톨로지 DB 개편)의 대부분은 완료됐고 **현행 백로그 정본은 `docs/release/14-prd-reprioritization.md` 「현행 백로그」** 다.
> 요약: D0 seoul 정본 전환 완료 · ComingSoon 재구현·프론트 재구성 P1~P7 완료(#81~#115) · B1 분류축 FK화 완료 · B3 멀티테넌시는 진입점만 문서화(보류) ·
> B4 배정 스코핑은 구현 확인 · B5 가명처리 게이트웨이 완료(#175) · 관계망(Track B)은 제거(#171~#173).

---

## 10. 전환 기록 (2026-09-27): 2계정 → 단일 계정 · 역할 분리

- **연표**: 08-19 v1 FINAL(2계정 W·U, 수렴 프로토콜) → 09-03 W 머신의 마지막 채널 유입(게시 수 W 62 vs U 264) → 09-04 U 단일세션이 양축 대행(메모리·현황 한 줄에만 기록) →
  09-27 #197 하네스 코드화(에이전트 정의·레인 가드·/verify-pr) → 09-27 사용자 결정 D-20260927-02~06 → 플러그인 `harness` 0.1.0 으로 추출 → 이 v2.
- **바뀐 것**: 계정 → 역할 컨텍스트 · 검증자 = 서브에이전트 · 사람 자리(W) = QA·머지·결정(U 세션에서도) · 수렴 프로토콜 폐기 · agent-sync 의미(저널·사람 자리 기록) ·
  검증 티어 · 하네스 런타임을 플러그인으로(여러 프로젝트 재사용, 프로젝트엔 `.claude/harness.json` 만).
  레인 소속: verify 글롭 확장(`supabase/**/verify_*.sql` → `**/verify_*.sql`) · settings.json(옛 U)/CLAUDE.md 하네스 섹션(옛 W 저작) → 공유 · 공유 목록 확장(옛 공유 = `CLAUDE.md` 하나 → `.claude/harness.json` `lanes.shared` 전체).
- **안 바뀐 것**: 레인 원칙(W=계약·검증, U=구현) · PR/CI 게이트 · 접두 · main 보호 · Manual-Ops 게이트 · 머지 = 사람 승인.
- **되돌림**: W 계정 세션이 복귀하면 "두 번째 사람 자리" 또는 사람이 w-verifier 절차를 직접 운전하는 보조 검증 세션으로 — 레인·채널·접두 변경 없음. Remote Control 은 라이브 보조 채널.
- 상세: `docs/release/18-single-account-operating-model.md`.

---

## 11. 성공 기준

- [ ] 구현 컨텍스트 ≠ 검증 컨텍스트 100%(자기 PR 사인오프 0)
- [ ] high 티어 → `/harness:verify-pr` 100%
- [ ] 레인 가드 우회 0
- [ ] 사람 개입 = 승인·QA·결정만(상태 복붙 0)
- [ ] main 항상 그린 · verify SQL 전부 통과 · 핵심 플로우(신청→동의→선정→계획→심의→지출→정산) 수동 QA 통과
