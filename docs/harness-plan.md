# 병렬 에이전트 하네스 운영 계획 — 개인예산제 앱

> 2개의 Claude Code 인스턴스(**W · U**)를 한 저장소에서 병렬 운영해
> **충돌·재작업·토큰 낭비 없이** 협업한다.
> 대상 작업: **온톨로지 기반 DB 구조 개편** + **서울형 개인예산제 웹 앱 우선 구축**.
>
> 상태: **FINAL — 수렴 완료** (W-v1 ⇄ U-round2, agent-sync 채널, 2026-08-19). 양쪽 `STATUS: FINAL / AGREE` 성립.
> 원본 하네스 스킬: `parallel-agent-harness` (EASYREAD에서 일반화). 이 문서는 그 템플릿을 이 프로젝트에 맞춰 채운 것(= "개조").

---

## 1. 왜 병렬·분리인가 (버리지 말 것)

핵심은 속도가 아니라 **자기 결과를 자기가 채점하지 않게 하는 것**이다.
- **설계·검증(테스트를 만드는 손)** 과 **구현(코드를 짜는 손)** 을 다른 세션에 둔다 → 확증편향·자기채점 방지.
- 각자 **자기 레인**에만 토큰을 쓰고, 상태는 복붙 대신 git 채널로 나른다 → 협업 토큰 비용↓.
- 이 두 이득은 세트다. 레인을 안 나누면 충돌, 채널이 없으면 사람이 복붙 셔틀이 된다.

이 프로젝트는 이미 in-flight 브랜치가 **설계(온톨로지) ↔ 구현(서울형 리빌드)** 으로 자연히 갈라져 있어
하네스 축과 정확히 일치한다. 그 갈래를 하네스로 규율화한다.

---

## 2. 인스턴스 구성 (역할 스킬 매핑 = 하네스 '개조'의 핵심)

| 에이전트 | 환경/계정 | 축 | 역할 스킬 | 레인(디렉터리·파일 소유) |
|---|---|---|---|---|
| **W** | Windows / 개인 | **설계·검증** | `/pl` `/qa` `/ux-ui` `/pm` `/easy-read-review` | `Plan&Source/ontology/`, `supabase/**/verify_*.sql`, `src/**/*.{test,spec}.{ts,tsx}`, `src/test/`, `vitest.config.ts`, `.claude/skills/`, `docs/harness-plan.md`, CLAUDE.md 하네스 섹션 |
| **U** | Ubuntu / 팀 | **구현·배포** | `/backend` `/frontend` `/devops` | `src/` 구현코드(테스트 제외), `supabase/`(빌드 SQL·`migrations/`), `.github/workflows/`, `src/types/database.ts`, 빌드설정(`next.config.ts`·`postcss`·`eslint`·`package.json`), `docs/release/`, `.claude/settings.json` |

> **축 정하는 규칙(하나뿐)**: 결과를 만드는 손과 그것을 검증하는 손을 분리한다.
> 이 프로젝트는 "**설계·검증 ↔ 구현·배포**" 분할을 채택한다.

### 역할 스킬 → 레인 호출 지도
각 세션은 자기 축의 역할 스킬만 주도적으로 호출한다(상대 축 스킬은 참고만).

- **W 세션이 호출**:
  - `/pl` — 아키텍처·데이터모델 방향, 코드 리뷰(요구충족→타입→성능→보안→접근성→테스트 순), 기술 결정문.
  - `/qa` — 테스트 계획·골든/계약 테스트, 릴리스 품질 게이트, 접근성(axe) 검증.
  - `/ux-ui` — 사용자 흐름·IA, 발달장애인 인지 접근성 설계 검토.
  - `/pm` — 일정·마일스톤·리스크, 산출물 추적, 이해관계자(기관) 문서.
  - `/easy-read-review` — UI 문구·라벨 쉬운정보 검수(≥70점 게이트).
- **U 세션이 호출**:
  - `/backend` — Supabase 스키마·RLS·마이그레이션·쿼리·Edge Function, 예산 계산 로직.
  - `/frontend` — Next.js 화면·컴포넌트·훅, 접근성 속성 구현.
  - `/devops` — CI/CD·Vercel 배포·환경변수·Supabase 운영 모니터링.

---

## 3. 레인(충돌 방지) — 이 저장소 특이점 반영

이 repo는 테스트가 `src/`에 **co-located** 이라(vitest `include: src/**/*.{test,spec}`),
레인을 최상위 디렉터리가 아니라 **파일 접미사**로도 가른다 → 같은 파일을 둘이 만지지 않는다(1:1:1 유지).

- `Plan&Source/ontology/` (RDF/OWL·스키마 draft·검토보고서) → **W만** (설계 권위)
- `supabase/**/verify_*.sql` (검증 쿼리) → **W만** · 그 외 `supabase/` 빌드 SQL·`migrations/` → **U만** (접미사 분리)
- `src/**/*.{test,spec}.{ts,tsx}`, `src/test/`, `vitest.config.ts` → **W만** · 그 외 `src/`·`src/types/database.ts` → **U만**
- `.claude/skills/`, `docs/harness-plan.md` → **W만** · `.claude/settings.json`(+SessionStart 훅)·`docs/release/` → **U만**
- **공유 파일** `CLAUDE.md`: 하네스 섹션 = W 저작, 「현재 작업 현황」 = 양쪽 append, 그 외 프로젝트 가이드 구조변경 = U.
  (주 상태 채널은 CLAUDE.md가 아니라 agent-sync — CLAUDE.md 편집은 최소화)
- 레인은 **디스크상 겹치지 않게** 긋는다. 충돌이 자주 나면 레인 설계 오류 신호.

---

## 4. Git 워크플로

```
main ───────────────────────────────► (항상 그린, 브랜치 보호)
  ├── U: feat/* 구현·마이그레이션 ──► PR → main
  └── W: 실패하는 골든/계약 테스트·verify SQL ──► (test-first) → U가 초록 만들면 merge
통합 base: db-ontology-rdf-format (in-flight 최신) — 협의 후 확정
```
- 코드 핸드오프는 **PR·CI**로만. main 직접 push 금지.
- 브랜치 보호(strict): 각 PR 최신화 → CI 재green → merge.

---

## 5. 작업 흐름 패턴 (test-first 기본)

| 순서 | 에이전트 | 작업 |
|---|---|---|
| 1 | **W** | 동작을 **실패하는 골든/계약 테스트**(또는 verify SQL)로 먼저 못 박음(스펙 역할) |
| 2 | **U** | 그 테스트를 초록으로 만드는 구현·마이그레이션 |
| 3 | **W** | 게이트·리뷰(+easy-read·a11y)로 검증 → merge |

- **첫 파일럿**: `src/utils/copay.ts`(본인부담금 계산, 순수함수·예산 핵심) — W 골든테스트 → U 초록.
  `src/utils/budget-visuals.test.ts` 선례와 동형이라 배관 검증에도 최적.
- 규칙 = 파일 = 테스트 **1:1:1** → 실패 지점 즉시 특정, 디버깅 대화 감소.

---

## 6. 커뮤니케이션 규약

- 핸드오프 커밋 접두: `[HANDOFF→W]` · `[HANDOFF→U]` · `[SYNC]`
- 상태 채널: `bash scripts/agent-sync.sh {pull | post <w|u> "..." | log}`
- **수렴 프로토콜**(자동 의논 종료 조건): 각 글 끝에 STATUS 1줄 —
  `STATUS: PROPOSE <U|W>-vN` | `STATUS: AGREE <상대버전>` | `STATUS: FINAL`.
  수렴 = 양쪽이 동일 버전에 AGREE → 각자 자기 레인 파일로 설치 적용. 6라운드 초과 시 사용자 에스컬레이션.

---

## 7. 상태 동기화 — 복붙 제거 (agent-sync)

- 전용 `agent-sync` 브랜치(orphan)를 메시지 보드로 쓴다. **코드는 안 담고 main에 병합하지 않는다.**
- `pull`(세션 시작 시 상대 상태 로드) / `post`(턴 종료 시 내 상태 기록). 임시 worktree로 채널만 갱신.
- SessionStart 훅에 `pull`을 걸어 자동 로드(`.claude/settings.json`, U 소유).

---

## 8. 통합 로드맵 (콘텐츠 레이어 — 사용자 GOAL 직결)

> 하네스는 "어떻게 협업하나"이고, 이 절은 "무엇을 만드나"다. GOAL = ① 온톨로지 DB 개편 + ② 서울형 앱 우선.

### 8.0 현황 (in-flight = stacked 브랜치, U 조사로 확정)
`ontology-disability-case-management`(설계문서 11) **⊂** `seoul-personal-budget-rebuild`(+앱리빌드 15) **⊂**
`db-ontology-rdf-format`(+RDF 1) = **상위집합 → 통합 base 확정.**
- 준비된 자산(base): `supabase/seoul/` 27+테이블·RLS·그래프뷰·시드, 서버액션 11종, copay/규칙엔진,
  구글로그인 신원연결·뷰 RLS 결함 수정, Phase 2~4 화면 일부.
- **우선순위**: ① 서울형 개인예산 앱(진행중) → ② 복지부 서식 → ③ 기존 데모 유지.

### 8.1 D0 결정 (PL 콜, 확정) — 배포 정본 전환
**(i) `supabase/seoul/` 를 배포 정본으로 전환.**
- `supabase/migrations/`(04~31, 구 앱)은 삭제하지 않고 `_archive/` 로 이관(git 이력·롤백 참조 보존).
- 데모 UUID(관리자 `00..01`·당사자 `11e9..`)는 `07_seed_program`/`08_seed_demo` 로 재현 → W가 시드 존재 verify 추가.
- 근거: 단일 정본으로 스키마 드리프트 제거. seoul 빌드는 멱등(IF NOT EXISTS)·완결. GOAL축 A의 1단계.

### 8.2 GOAL축 A — 서울형 개인예산 웹 앱 우선 구축
1. **통합 base → main** (D0 전환 포함) — U PR / W 검증.
2. **22개 ComingSoon 스텁 재구현** (45라우트 중): 거래장부·계획평가·서류함·예산·지도·참여자관리,
   관리자 설정/초대/피드백/리포트, 당사자 evaluations/plan → **서울형 27테이블 기반**.
   → **W**(`/ux-ui` 흐름·IA 명세 + `/qa` 컴포넌트 골든 선작성) → **U**(`/frontend` 구현).
3. **라이프사이클 테스트** — 신청→동의→선정→계획→심의→지출→정산 통합/E2E.
   → **W**(`/qa` 골든 선작성) → **U** 초록 + `generate-types` 자동화(`database.ts` 재생성).

### 8.3 GOAL축 B — 온톨로지 기반 DB 구조 개편
현재 복지부 3단 분류(대분류→중분류→지원예시)가 참조테이블 없이 **TS상수(`care-plans.ts`) + 자유텍스트
(`transactions`/`budget_line_items.category`, `support_goals.support_area`) + JSONB로 분산.**
- **B1 분류 참조테이블 승격** + `category` **FK화** → 사정·목표·예산·거래·평가를 **단일 분류축**으로 연결.
- **B2 `needs_assessment` 엔티티 신설** (복지부 서식 §4 욕구사정: 대·중분류 × 제한점 × 욕구·희망).
- **B3 `organizations` 멀티테넌시** — 현재 단일기관 하드코딩(`@nowondaycare.org`) → organizations + 스코프 RLS
  (base의 `seoul_executing_agencies` 참조데이터와 대조).
- 제외(base가 이미 해결): 정체성 이원화, 서울 신청/동의 모델. 설계만 존재: value_nodes, PCT 성과측정 6클래스.
- → **W**(`/pl` 설계권위: 온톨로지 RDF ↔ base 대조·확정, 두 온톨로지[서울형 6 ↔ 복지부 8] 판정)
  → **U**(`/backend` 마이그레이션·서버액션).

### 8.4 정합성 검증 (W 상시, [conformance-mapping](../supabase/seoul/) 참조)
- 온톨로지 RDF ↔ `supabase/seoul` 스키마 대응표 · `verify_*.sql` 재배치(→ `supabase/seoul/`, W소유) + 골든화.
- 신설 `verify_04_copay` — INV4/5 교차계층(`copay_status` DB CHECK 5값 ↔ TS `CopayStatus` ↔ `describeCopay`).
- 서울형 시드 `spending_rules` 중 `enforcement='block'` **0건** 검증(정책: 막지 않고 기록).

### 8.5 공통 릴리스 절차
- 코드: U PR → CI(tsc+lint+test+build) → W 리뷰(+easy-read·a11y) → main.
- 배포: **U** Vercel 프리뷰→프로덕션 · Supabase 마이그레이션은 대시보드 SQL Editor 수동 실행.

### 8.6 첫 착수 (파일럿) — 하네스 배관 검증
`src/utils/copay.ts` **계약(골든) 테스트**를 W가 통합 base에 배치 → `[HANDOFF→U]` → U 초록 확인.
(copay.ts는 base에 이미 구현되어 있어 배관·게이트·핸드오프 흐름 검증에 최적. 진짜 test-first는 8.3 B2 needs_assessment부터.)

---

## 9. 성공 기준

- [ ] 두 인스턴스가 **충돌 없이** merge(레인이 실제로 안 겹침)
- [ ] 사람의 상태 복붙 **0회**(모든 핸드오프가 채널·PR·커밋으로)
- [ ] main 항상 그린(모든 코드가 CI 게이트 통과 후 병합)
- [ ] 온톨로지 RDF ↔ 서울형 스키마 정합성 verify SQL **전부 통과**
- [ ] 서울형 개인예산 핵심 플로우(신청→동의→선정→계획→심의→지출→정산) E2E 통과
