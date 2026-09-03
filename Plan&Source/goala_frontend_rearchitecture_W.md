# 프론트엔드 전면 재구성 로드맵 (W 설계) — 서울형 개인예산제

> 작성: **W(설계·검증, `/pl` `/ux-ui` `/pm`)** · 대상: **U(구현·배포)** · 2026-09-03
> 요청: "현재 프론트엔드를 **전면 재구성**할 수 있게 계획을 세워라."
> 이 문서는 **로드맵(전략)** 이다. 각 Phase 는 별도 W 계약(골든/스펙) → U 구현 사이클로 실행한다.
> **선행 흡수**: `goala_seoul_screen_reset_W.md`(PR #81)=**Phase 1**, `krds_ux_a11y_W.md`=**Phase 5** 로 편입.

---

## 0. 원칙 — "전면 재구성"을 안전하게 하는 법

라이브(배포·로그인 작동 중)를 **rm -rf 재작성하지 않는다.** 대신 **스트랭글러(strangler-fig)**:
매 Phase 끝에 **앱이 배포 가능**하고, **도메인/데이터 레이어는 재사용**하며, **표현 레이어를 체계적으로 교체**한다.

| 재구성의 3원칙 | 의미 |
|---|---|
| ① 데이터·도메인 보존 | `supabase/seoul/**` + 골든 테스트된 `src/utils/**` 는 손대지 않는다(재구성 대상 아님). |
| ② 표현 레이어 교체 | 토큰 → 프리미티브 → 내비 → IA/라우트 → 화면 리트로핏 순으로 **아래에서 위로**. |
| ③ 매 단계 초록 | 각 Phase = `build·lint·test` green + 배포 가능. 부분 적용이 항상 동작. |

---

## 1. 보존 ↔ 재구성 원장 (무엇을 남기고 무엇을 갈아엎나)

| 레이어 | 판정 | 근거 |
|---|:---:|---|
| DB(`supabase/seoul/00~11`) | **보존** | 서울형 정본, 라이브 배포·검증 완료. UI 재구성과 무관. |
| 도메인 로직 `src/utils/**`(골든) | **보존** | budgetByDomain·orgLedger·copay·egoGraph·assetMap·evaluationTimeline·domainAxisReport·settlementStatus·uiPreferences·sis-a·needsAssessment 전부 단위테스트 잠금. 화면이 이걸 소비. |
| a11y 프리미티브 `ui/{Modal,LiveRegion,FormField}` | **보존·확장** | RED 계약 초록화됨(#56). 재구성의 **토대**로 그 위에 프리미티브 확충. |
| 이미 이전된 화면(당사자 홈·거래장부·신청·계획·평가…) | **리트로핏** | 폐기 아님. 토큰·프리미티브로 **점진 교체**(Phase 3~). |
| 내비게이션 6컴포넌트 | **재구성** | 파편화·죽은코드(§3.3). |
| 테마/토큰 사용 방식 | **재구성** | 하드코딩 `zinc-*` → 시맨틱 토큰(§3.1). |
| 공용 컴포넌트 레이어 | **신설** | Button/Card/StatusPill/PageHeader/MoneyText 등 부재(§3.2). |
| 라우트/IA | **합리화** | 중복·고아 라우트 정리(§3.4). |

---

## 2. 현 상태 부채 인벤토리 (실측 근거)

| # | 부채 | 근거(파일) | Phase |
|---|---|---|---|
| D-1 | 브랜딩 잔재(아름드리→서울형) | login·layout·AdminSidebar·SupporterLayoutClient·more | **P1**(#81) |
| D-2 | stale "준비중" 배지 | TabBar(죽은코드지만)·구현된 화면 배지 | **P1**(#81) |
| D-3 | ComingSoon 5화면(BUILD-B) | plan·settings·participants/[id]·preview·documents | **P5** |
| D-4 | **테마 토큰 부채**: `zinc-*` 하드코딩 → 다크/고대비/노랑 `!important` ~200줄 | `globals.css:353~648` | **P2** |
| D-5 | `data-theme="light"` 하드코딩(실 스위칭은 `html.class`) | `app/layout.tsx:22` | **P2** |
| D-6 | 공용 프리미티브 결핍(Button/Card/StatusPill/PageHeader/MoneyText) | 매 화면 `<header className="flex h-16…">`·`won()` 중복 | **P3** |
| D-7 | **내비 파편화**: TabBar(죽은코드)·NavDropdown(3화면)·AdminSidebar·SupporterLayoutClient·MoreMenuClient·ParticipantFab | `src/components/layout/**` | **P4** |
| D-8 | 중복 라우트: `supporter/participants/[id]` ↔ `admin/participants/[id]`; `supporter/[pid]/*` ↔ `supporter/participants/[id]` | 라우트 트리 | **P5** |
| D-9 | a11y F항목(폼 label·sidebar `aria-current`·헤딩순서) | `krds_ux_a11y_W.md` §2 | **P6** |
| D-10 | stale 정보(GPT-4o·"회계장부") | login:188/202·AdminSidebar:97 | **P1/P6** |

---

## 3. 목표 아키텍처

### 3.1 디자인 파운데이션 — 토큰 & 테마 (Phase 2)

**문제**: `@theme` 시맨틱 토큰(`--color-background/foreground/card/muted/border/primary/positive/warning/danger`)이
정의돼 있으나, 화면은 `bg-white`·`text-zinc-600` 를 직접 쓴다. 그래서 다크/고대비/노랑 모드가 하드코딩 클래스를
`!important` 로 일일이 되받아치는 ~200줄 오버라이드가 됐다(브리틀·확장 불가).

**목표**:
- 화면은 **시맨틱 토큰만** 사용: `bg-background`·`bg-card`·`text-foreground`·`text-muted-foreground`·
  `border-border`·`text-primary`·상태색은 `status-safe/caution/danger` 유틸. (raw `zinc-*`/`bg-white` 금지.)
- 테마 스위칭 = **토큰 값만 교체**(`html.dark-mode { --color-* }`), `!important` 오버라이드 제거.
- `data-theme` 실 사용(사용자 선택 시 root 속성 스탬프) — 현재 하드코딩 `light` 제거.
- 접근성 7모드(폰트3·고대비·노랑·다크·쉬운용어)는 유지하되 **토큰 기반**으로 재구현(useAccessibility API 불변).
- **계약(W)**: "리트로핏된 화면에 `!important` 테마 오버라이드가 필요 없다"를 회귀로 잠금(lint 규칙 or 스냅샷).

### 3.2 컴포넌트 시스템 (Phase 3)

3계층: **ui/(프리미티브) → features/(도메인) → app/(라우트 조립)**. 신설 프리미티브(토큰·a11y 내장):

| 프리미티브 | 대체 대상(현 중복) | 계약 |
|---|---|---|
| `Button`/`LinkButton` | 매 화면 `className="… rounded-2xl …"` 버튼 | 44px·variant(primary/ghost/danger)·loading·`aria-*` |
| `Card`/`Section` | `<section className="p-… rounded-3xl ring-1 …">` | 토큰 배경·라운드·헤딩 슬롯 |
| `PageHeader` | `<header className="flex h-16 …">` 44곳 | title·back·actions·sticky·`main#main-content` 스킵 타깃 정합 |
| `StatusPill` | `PARTICIPANT_STATUS`·`STATUS_LABEL`·정산배지 산재 | **비색 큐 병행**(색+텍스트/형태, S5) |
| `MoneyText` | `won()` 헬퍼 중복 정의 | `toLocaleString('ko-KR')+"원"` 1벌·`aria` |
| `EmptyState` | "아직 없어요…" 산재 | 아이콘+문구+다음행동(G5) |
| `BudgetCard`/`DomainCard` | 홈·허브 영역별 카드 | `buildBudgetByDomain` 소비 표준 카드 |

> 재사용 우선: 이미 있는 `Modal`·`LiveRegion`/`useToast`·`FormField`·`useMounted`·`activityEmoji`·`copay`·
> `settlementStatus` 를 프리미티브가 내부 소비. **신규 의존성/아이콘 라이브러리 없음**(이모지 유지).

### 3.3 내비게이션 아키텍처 (Phase 4)

**현 파편화**: `TabBar`(죽은코드) · `NavDropdown`(햄버거, 3화면만) · `ParticipantFab`(하단 단일액션) ·
`AdminSidebar`+`SupporterLayoutClient`(실무자) · `MoreMenuClient`(더보기) · `NavigationProgress`.

**목표(역할별 단일 내비 규범)**:
- **당사자**: 상시 하단 **TabBar 부활**(홈·영수증·더보기 3탭, `krds_ux_a11y_W.md` §3 결정) + `ParticipantFab`(내가 쓴 돈 적기)
  공존. 전체메뉴는 `/more` 허브. `NavDropdown`(햄버거) 역할 축소/제거. TabBar 내 supporter/admin 죽은 분기 제거.
- **실무자·관리자**: `AdminSidebar` 정본(서울형 생애주기 메뉴). `aria-current`·`aria-expanded`·nav `aria-label` 보정(N1~N3).
- 공통: `aria-current="page"`, 44px, 비색 활성큐.

### 3.4 정보 아키텍처(IA) — 역할 × 서울형 생애주기 (Phase 5)

**서울형 생애주기**: 신청 → 동의 → 선정 → (욕구)사정 → 이용계획 → 심의 → 통지 → 예산배정 → 지출 → 정산 → 평가.

**목표 라우트 트리(canonical)** — 역할은 **URL 접두가 아니라 접근 게이트**(레이아웃 가드+RLS):

```
(participant)  당사자 — 모바일 600px
  /                     홈(잔액·영역별·copay)
  /receipt              영수증(지출 기록)
  /more                 허브 → 계획·달력·사진·지도·설정·서류
  /my-plan /plan        내 이용계획 / 해보고 싶은 것(goal_to_try)
  /calendar /gallery /map /guide
  /settings/{display,profile}

(supporter)  실무자·관리자 — 데스크톱 사이드바 + 모바일 드로어
  /supporter                        대시보드(담당 요약)
  /supporter/participants           담당 당사자 목록
  /supporter/participants/[id]      ★당사자 통합 허브(모든 축 진입점) — canonical
       └ /assessment /plan /report /transactions   (하위 축, 통일된 nesting)
  /supporter/applications[/new|/[id]]   신청·선정
  /supporter/plans[/new|/[id]]          이용계획·심의
  /supporter/review                     영수증 검토 대기
  /supporter/transactions[/[id]]        org 거래장부(정산)
  /supporter/documents                  서류 보관함(#79)
  /supporter/evaluations[/[pid]]        평가·모니터링
  /supporter/{map,network}              활동지도·관계망
  /supporter/budgets/[id]               예산 배정 상세
  (admin 전용) /admin, /admin/settings(제도현황), /admin/invitations, /admin/feedback,
               /admin/participants/new, /admin/participants/[id]/preview
```

**중복 해소(D-8)**:
- `admin/participants/[id]` 와 `supporter/participants/[id]` → **하나의 통합 허브로 수렴**(RLS 가 admin=전체·supporter=배정 스코핑). admin 경로는 리다이렉트.
- `supporter/[participantId]/{assessment,report,transactions}` → `supporter/participants/[id]/*` 로 **nesting 통일**(구경로 리다이렉트).
- `admin/participants/[id]/report` → `supporter/participants/[id]/report` 리다이렉트(트리아지 D2).
- `supporter/transactions/new` → 당사자 스코프 `/new` 로(트리아지 D3).

> ★IA 제품결정 필요(§7 Q1): "당사자 관리"를 admin/supporter 로 **접두 분리 유지**할지, **단일 트리+역할게이트**로 통합할지.

### 3.5 데이터·RSC 패턴 (전 Phase 공통)

- **RSC 우선**: 서버 컴포넌트에서 조회, 클라이언트는 상호작용만(`use client` 최소).
- **공유 뷰 추출**: `ParticipantHomeView({participantId, mode})`(당사자 홈 ↔ admin preview 1벌, 트리아지 §4-8). ★preview 뮤테이션 안전.
- **signed URL**: `extractStoragePath`+`createSignedUrl`(admin) 서버 사전생성(CLAUDE.md Storage 규칙).
- **폼**: `FormField`+`useToast`(a11y 라이브영역). 서버액션 `src/app/actions/**` 패턴 유지.

---

## 4. Phase 로드맵 (각 단계 = 배포가능·독립 초록)

| Phase | 내용 | 산출/게이트 | 상태 |
|---|---|---|---|
| **P1 마이그레이션 마무리** | 브랜딩 완전교체·네비위생·ComingSoon 정리 | `goala_seoul_screen_reset_W.md` = **PR #81** | W 완료·U 대기 |
| **P2 토큰·테마 파운데이션** | `zinc-*`→시맨틱 토큰, `!important` 오버라이드 제거, `data-theme` 실사용 | 토큰 매핑표(W) + lint 규칙 + 테마 회귀 | 설계 대기 |
| **P3 프리미티브 + 리트로핏** | Button/Card/PageHeader/StatusPill/MoneyText/EmptyState 신설 → 고빈도 화면(홈·거래장부·목록) 우선 교체 | 프리미티브 RED 계약(W) → U green | 설계 대기 |
| **P4 내비 통일** | 당사자 TabBar 부활+FAB 공존, 햄버거 축소; 실무자 사이드바 a11y 보정 | `krds_ux_a11y_W.md` §3 + nav 계약 | 부분설계 존재 |
| **P5 IA/라우트 합리화 + BUILD-B** | 중복라우트 수렴·리다이렉트·nesting 통일 + B1/B3/B4/B5 화면 | 트리아지 §4 + §3.4 IA 결정 | 부분설계 존재 |
| **P6 a11y 리트로핏 + easy-read** | 폼 label·헤딩순서·aria-current·신규 카피 easy-read | `krds_ux_a11y_W.md` §2 Phase A~C + `docs/a11y/phase-c-plan.md` | 부분진행 |
| **P7 폴리시·시각회귀** | 애니메이션·빈상태·마이크로카피 다듬기, (선택)비주얼 회귀 | 시각 QA | 후속 |

**권장 실행 순서**: P1 → **P2(토대)** → P3 → P4 → P5 → P6 → P7.
P2 를 먼저 하는 이유: 토큰 정리 없이 화면을 리트로핏하면 `!important` 부채가 재생산된다(토대부터).

---

## 5. 테스트·검증 전략

- **도메인**: `utils/**` 골든 유지(회귀 0) — 재구성이 로직을 안 건드림을 보장.
- **프리미티브**: 각 신규 프리미티브 RED 계약(W) → U green(Modal/LiveRegion/FormField 선례).
- **a11y CI**: jsx-a11y(#57) 유지·강화 → warn 0 수렴 후 error 승격(`docs/a11y/phase-c-plan.md`).
- **easy-read**: 신규/변경 당사자 카피 `validate_easy_read` errors 0(W 게이트).
- **테마**: 리트로핏 화면에 `!important` 테마 오버라이드 불요(P2 회귀).
- **게이트**: 매 PR `npm run build·lint·test` + CI(quality-check·db-verify) green. main 머지 시 Vercel 자동 재배포 육안.

---

## 6. 레인·핸드오프·리스크

- **레인**: W = `Plan&Source/**`·`src/**/*.test.tsx`(계약/골든/스펙). U = `src/`(구현)·빌드설정. main 직접 push 금지.
- **핸드오프**: Phase 별 W 계약 확정 → `[HANDOFF→U]` → U 구현 → W 초록·리뷰(요구→타입→성능→보안→a11y→easy-read)→ 머지.
- **충돌 회피**: 진행 중 U 브랜치 #79(B2 서류함)·#80(provider anon)·PR #81(P1) 존중.
- **리스크·롤백**: 스트랭글러라 매 Phase 독립 배포·독립 revert. P2/P3 는 화면 다수 접촉 → **고빈도 화면부터** 좁게 시작해 리스크 분산. 큰 IA 이동(P5)은 **리다이렉트로 구경로 보존**(북마크·링크 안깨짐).

---

## 7. 사용자 제품결정 (Phase 진입 전 확인)

1. **[IA·Q1] "당사자 관리" 트리 통합** — admin/supporter **접두 분리 유지** vs **단일 트리+역할게이트 통합**(§3.4). 통합이 중복을 없애지만 라우트 이동 규모 큼.
2. **[비주얼·Q2] 재구성의 성격** — **구조·토큰·내비 중심(룩앤필 대체로 유지)** vs **비주얼 리디자인 동반(새 시안 필요)**. 후자는 별도 UX 시안 단계 추가.
3. **[범위·Q3] 착수 깊이** — P1~P2 까지(토대만 견고화) vs P1~P5(IA까지 전면) vs 전체 P1~P7.

> 위 3개는 로드맵을 **실행**으로 옮길 때의 분기다. Phase 1(#81)은 결정 무관하게 선행 가능.
