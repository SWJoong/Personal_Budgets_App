# P4 내비게이션 통일 — 설계 (W 저작, U 구현)

> 로드맵: 프론트 재구성 #82 **Phase 4**. 전제: P3 프리미티브(#92·#95) 안착(main=`63ac23e`).
> 이 문서는 **RED 계약**(`src/components/layout/*.test.tsx` + `(participant)/layout.test.tsx`, [HANDOFF→U])의
> 설계 근거이자 U 세션의 구현 명세다. 계약은 **행위·ARIA·구조만** 단언하고 **토큰·색·className·픽셀은
> 단언하지 않는다** — 그건 `tokenFoundation.test.ts` fs-scan + eslint jsx-a11y + W 리뷰 스윕이 잡는다.
> 근거: `Plan&Source/krds_ux_a11y_W.md` §2.4(탐색 감사) + §3(당사자 상시 탐색 결정).

---

## 0. 왜 P4 인가 (감사 동기)

KRDS §2.4 탐색 감사 판정 요약:

| # | 항목 | 판정 | 위치 |
|---|------|:---:|------|
| N1 | 각 nav `aria-label` | F(일부) | AdminSidebar nav 는 '주요 메뉴' 有(PASS), TabBar '메인 네비게이션' 有 |
| N2 | 현재 위치 `aria-current` | **F(부분)** | NavDropdown/TabBar P, **AdminSidebar F**(시각큐만: `bg-white/10`+pulse dot) |
| N3 | 토글 `aria-expanded`+키보드 | **F** | AdminSidebar 서브메뉴 토글·'빠른 설정' disclosure |
| N4 | 당사자 상시 탐색 존재 | **F** | TabBar 죽은 코드(미마운트) · `(participant)/layout` 은 FAB 만 |

핵심 공백 3가지: **(A)** 당사자 화면에 navigation 랜드마크 자체가 없음(TabBar dormant) · **(B)** 당사자
탐색 목적지 미확정(구 TabBar 3탭이 실화면과 불일치) · **(C)** AdminSidebar 활성/펼침 상태가 시각큐로만
전달돼 SR·키보드 사용자에게 프로그램적 현재위치가 없음.

---

## 1. ★사용자 확정 결정 (2026-09-04) — KRDS §3 갱신

KRDS §3 은 "TabBar 부활 + **탭 3개 유지(홈·영수증·더보기)**"로 결정했으나, 이후 **사용자가 목적지 구성을
확정**하며 그 항목을 갱신한다(이 문서가 §3-step2 를 대체).

**당사자 하단 내비 = 정확히 4탭 + FAB**

| 슬롯 | 라벨 | href | 근거 |
|---|---|---|---|
| 탭1 | 홈 | `/` | 대시보드 진입점 |
| 탭2 | 달력 | `/calendar` | 일정·활동 조망(실화면 존재) |
| 탭3 | 계획 | `/plan` | 오늘 계획(실화면 존재) |
| 탭4 | 더보기 | `/more` | 갤러리·지도·설정 등 2차 목적지 허브 |
| **FAB** | 📷 내가 쓴 돈 적기 | `/receipt` | 단일 주 액션 — TabBar '위'에 배치 |

**결정 핵심**
- **영수증 탭 없음.** `/receipt` 는 FAB 가 단독 소유한다 → 탭과 FAB 의 **목적지 중복을 제거**. 지출 기록은
  당사자의 최빈·최중요 동작이라 하단 중앙 FAB(엄지 자연 호)로 승격, 4탭은 '보기/탐색' 목적지로 정리.
- **갤러리는 '더보기' 안.** 1차 탭 수를 4로 묶어 인지부하를 낮춘다(발달장애인 easy-read: 미니멀·예측가능).
- **FAB ↔ TabBar 공존.** FAB 를 TabBar 위에 배치해 하단 fixed 충돌을 해소한다(배치는 CSS 리뷰 몫).

> 왜 4탭인가: ux-ui 원칙 "핵심 기능은 1탭 접근·depth ≤ 2"; 4탭은 홈/달력/계획(핵심 조망) + 더보기(허브)로
> 딱 떨어진다. 3탭(구안)은 실화면(달력·계획)을 숨겨 탐색 depth 를 늘렸고, 영수증 탭은 FAB 와 중복이었다.

---

## 2. 계약별 설계 근거 (RED)

각 계약은 대상 파일에 콜로케이트한 `*.test.tsx`(정본). 아래는 근거·KRDS 매핑·RED 사유 요약.

### C1. `participant-tabbar-4tab-structure` — `TabBar.test.tsx`
- **KRDS**: §2.4 N4(당사자 상시 탐색) + §1 확정 4탭.
- **단언**: nav 랜드마크(`getByRole('navigation',{name:'메인 네비게이션'})`) · 당사자 링크 정확히 4개 ·
  홈`/`·달력`/calendar`·계획`/plan`·더보기`/more` href · 영수증 링크 `null`.
- **RED 사유**: `participantTabs` 가 현재 `[홈'/', 영수증'/receipt', 더보기'/more']` 3탭 — 달력·계획 링크
  부재, 영수증 잔존. length===4·/calendar·/plan·영수증 null 이 모두 FALSE.
- **훅 모킹**: `usePathname`(기본 '/') + `useAuth`(user=null → 내부 role 기본값 'participant'). supporter/
  admin 탭 배열은 이 계약 범위 밖(4탭 확정은 당사자만).

### C2. `participant-tabbar-active-aria-current` — `TabBar.test.tsx`
- **KRDS**: §2.4 N2(현재 위치 aria-current).
- **단언**: `usePathname='/calendar'` → 달력 링크만 `aria-current='page'`(활성 정확히 1개) ·
  `usePathname='/'` → 홈만 활성('/' 정확일치, 회귀가드).
- **RED 사유**: aria-current 배선 자체는 기존 TabBar 에 존재(GREEN)하나 활성대상 링크(/calendar·/plan)가
  미존재해 활성 해석이 성립 불가 → 부분 FALSE. 3→4탭 리팩터 후에도 유지돼야 하는 회귀가드 겸용.
- **불변식**: `isActive = pathname===href || (href!=='/' && pathname.startsWith(href))`; '/' 는 정확일치만.

### C3. `participant-layout-mounts-nav-landmark` — `(participant)/layout.test.tsx`
- **KRDS**: §2.4 N4 + §3(TabBar 부활).
- **단언**: 당사자 레이아웃을 children 과 통합 렌더 시 `getByRole('navigation')` 도달 + FAB 공존.
- **마운트 전략**: `(participant)/layout` 은 **동기 서버 컴포넌트**(async 아님)라 jsdom 통합 렌더 가능 →
  전략 (a) 통합 렌더 채택. TabBar 를 클라이언트 경계 안에 그대로 마운트.
- **RED 사유**: layout 이 `<ParticipantFab/>` 만 렌더하고 TabBar import 부재 → 당사자 화면에 navigation
  랜드마크 자체가 없음. FALSE.

### C4. `participant-fab-destination-guard` — `ParticipantFab.test.tsx`
- **KRDS**: §3-step4(햄버거/목적지 중복 제거) + §1 FAB 결정.
- **단언**: FAB href `/receipt` · aria-current 미보유(탭 아님) · `/receipt`·`/supporter`·`/admin`·`/login`
  에서 null 반환.
- **성격**: 대부분 **GREEN(회귀가드)**. 영수증 탭 제거 후에도 FAB 가 /receipt 단독 소유(중복 해소)를
  유지하는지 잡는다. RED 사유는 인접 리팩터 회귀로 한정(공존 리팩터 시 /receipt 를 다시 nav 에 넣거나 FAB 를
  탭으로 흡수하면 이 가드가 잡는다). 배치·safe-area 는 CSS 리뷰(jsdom 불가).

### C5. `admin-sidebar-active-aria-current` — `AdminSidebar.test.tsx`
- **KRDS**: §2.4 N2(AdminSidebar F — 시각큐만).
- **단언**: `usePathname='/admin/participants'` → '당사자 관리' 메뉴 링크 + 활성 서브항목('전체 목록',
  pathname===sub.href) 모두 `aria-current='page'` · 비활성 링크는 미보유.
- **RED 사유**: 파일 내 aria-current **0건** — 활성표시가 `bg-white/10` + `animate-pulse-gentle` 점 등
  시각큐로만 제공. FALSE.
- **오탐 방지**: nav `aria-label='주요 메뉴'`(:114)와 모바일 햄버거(SupporterLayoutClient)는 이미 PASS —
  RED 로 넣지 않는다.

### C6. `admin-sidebar-submenu-aria-expanded` — `AdminSidebar.test.tsx`
- **KRDS**: §2.4 N3(토글 aria-expanded).
- **단언**: sub 보유 항목 토글 버튼이 `isSubOpen` 에 맞는 `aria-expanded` 노출 + 클릭 시 true↔false 반영.
- **RED 사유**: 토글 버튼(:147-154)이 `aria-label`('접기'/'펼치기')만 갖고 aria-expanded **0건**. FALSE.
- **스트레치(계약 아님)**: `aria-controls` 로 서브패널 연결. `isSubOpen` 기본값 = `isActive`.

### C7. `admin-sidebar-quicksettings-aria-expanded` — `AdminSidebar.test.tsx`
- **KRDS**: §2.4 N3(disclosure).
- **단언**: '빠른 설정' 버튼(:185-192)이 `quickOpen` 에 맞는 `aria-expanded` 노출 + 클릭 시 반영.
- **RED 사유**: 버튼에 aria-expanded 부재(파일 내 0건). FALSE. 서브메뉴 계약과 동일 패턴, 별도 버튼이라
  분리 계약.

---

## 3. raw → P2 시맨틱 토큰 매핑표 (tokenFoundation 락 대상)

**계약 어서션 아님** — 구현 시 raw 팔레트를 아래 토큰으로 치환하고, 치환 완료 파일을
`tokenFoundation.test.ts`(`TOKENIZED_FILES`)에 등재해 재하드코딩을 fs-scan 으로 막는다. 값 교체는
`globals.css` 토큰만 바꿔 4모드(dark/high-contrast/yellow-bg)를 처리 — 컴포넌트 내 모드 분기 금지.

### 3-1. TabBar (`src/components/layout/TabBar.tsx`) — **1차 락 대상**
| 현재 raw | 역할 | → P2 토큰(클래스) |
|---|---|---|
| `border-zinc-200` | nav 상단 경계 | `border-border` |
| `bg-white` | nav 표면 | `bg-card` (또는 `bg-background`) |
| `text-zinc-500` | 비활성 탭 텍스트 | `text-muted-foreground` |
| `hover:text-zinc-700` | 비활성 hover | `hover:text-foreground` |
| `text-primary` | 활성 탭(이미 토큰) | 유지 |
| `bg-amber-100 text-amber-700 ring-amber-200` | '준비중' 배지 | `bg-warning-bg text-warning-fg ring-warning` |
| `min-w-[64px] … min-w-[44px]` **중복** | 터치타깃 | 단일 클래스로 정리(예: `min-w-[64px] min-h-[44px]`) — 계약 아님, 정리 권고 |

### 3-2. AdminSidebar (`src/components/layout/AdminSidebar.tsx`) — 2차(신규 토큰 필요)
어두운 slate 그라디언트 사이드바는 현재 시맨틱 토큰이 없다. **사이드바 전용 토큰 세트 신설 권고**
(`--color-sidebar`, `--color-sidebar-foreground`, `--color-sidebar-active` 등). 매핑 초안:
| 현재 raw | 역할 | → 신규 토큰(제안) |
|---|---|---|
| `from-slate-900 to-slate-800` | 사이드바 표면 | `bg-sidebar` |
| `text-slate-300 / text-slate-400` | 사이드바 텍스트 | `text-sidebar-foreground / -muted` |
| `bg-white/10 text-white`(활성) | 활성 메뉴 | `bg-sidebar-active text-sidebar-active-fg` |
| `bg-blue-400`(pulse dot) | 활성 지시점 | `bg-sidebar-accent` |
| `bg-amber-400/20 text-amber-300 ring-amber-400/30`(SoonBadge) | 준비중 | `warning-*` 계열 |

> AdminSidebar 토큰화는 신규 토큰 정의가 선행돼야 하므로 P4 는 **ARIA 계약(C5~C7)만** 필수 범위로 하고,
> 토큰화는 후속 스윕(선택)으로 분리한다. ParticipantFab 은 단색(`bg-zinc-900 text-white`) 브랜드 액션이라
> 토큰화 우선순위 낮음(리뷰 판단).

---

## 4. 구현 순서 (U)

1. **TabBar 4탭 리팩터** — `participantTabs` 를 홈/달력/계획/더보기 4개로 교체, 영수증 항목 삭제.
   중복 `min-w-*` 정리, 이모지 span `aria-hidden="true"` 부여(라벨이 이름 제공) → C1·C2 초록.
2. **당사자 레이아웃 마운트** — `(participant)/layout` 에 `<TabBar/>` 추가(FAB 와 공존, TabBar 위에 FAB
   배치되도록 하단 여백/z-index 조정) → C3 초록. FAB 는 그대로 유지 → C4 회귀가드 유지.
3. **AdminSidebar ARIA** — 활성 메뉴/서브항목 Link 에 `aria-current={isActive?'page':undefined}` 부여,
   서브 토글 버튼과 '빠른 설정' 버튼에 `aria-expanded={상태}` 부여(선택 `aria-controls`) → C5·C6·C7 초록.
4. **게이트**: `npm test`(신규 11 RED 초록) + `npm run lint`(jsx-a11y) + `npm run build` + CI quality-check.
5. **토큰 락**: 3-1 매핑으로 TabBar 치환 후 `tokenFoundation.test.ts TOKENIZED_FILES` 에 TabBar 등재
   (이 등재는 W 레인 — U 는 치환만, 등재/락 계약은 W 리뷰 스윕에서).

---

## 5. 핸드오프 & Open items

**핸드오프(→U)**: §2 C1~C7 계약 초록화(§4 순서) — TabBar 4탭 + 레이아웃 마운트 + AdminSidebar ARIA.
계약은 `test/w-p4-nav` 브랜치의 11개 RED 로 못박음. **src 구현/마운트 변경은 U 몫**(이 브랜치는 RED 계약만).

**게이트**: `npm test` 초록 + `npm run lint` + `npm run build` + CI `quality-check`.

**Open items (후속)**
- AdminSidebar 사이드바 토큰 세트 신설(§3-2) — 신규 토큰 정의 후 별도 스윕. P4 필수 범위 밖.
- supporter/admin TabBar 탭 배열: 담당자·관리자는 AdminSidebar/SupporterLayout 사용 → TabBar 죽은 분기
  제거 검토(표면 축소, 리뷰 판단).
- NavDropdown(햄버거) 역할 축소: 당사자 상시 4탭 도입 후 전체메뉴는 `/more` 허브로(KRDS §3-step4).
