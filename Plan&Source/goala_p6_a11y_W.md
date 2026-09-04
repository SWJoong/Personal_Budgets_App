# P6 a11y 리트로핏 — 설계 & RED 계약 (W)

> 로드맵: 프론트 재구성 #82 **Phase 6** — a11y 리트로핏(`krds_ux_a11y_W.md` §2 Phase A~C) + easy-read.
> 원칙(P3~P5 계승): W 가 **실패하는 계약(RED)만** 저작 → `[HANDOFF→U]` → U(app-6c)가 시맨틱 토큰·
> ARIA·구조 승격으로 **초록화**. W 는 `src/` 구현을 수정하지 않는다(계약·설계문만).
> 계약 정본은 각 테스트 파일. 이 문서는 매핑·근거·phasing·수동 스윕 가이드다.

기준 커밋: **main = b2f47b1**. 감사 시점(krds seed, 2026-08-26) 이후 P2~P5 가 머지되며 소스가
이동했다 — 아래 **§0 seed 대비 정정**이 이번 웨이브의 실제 RED 표면을 확정한다.

---

## 0. krds seed 대비 정정 (소스 이동 반영)

krds `§2` 판정은 감사 seed 다. P2~P5(#92·#95·#98·#99·#101) 머지로 다음이 이미 닫혔다 — **과대 RED 방지**를
위해 이번 웨이브에서 제외하거나 회귀 가드로만 둔다.

| seed 항목 | seed 판정 | b2f47b1 실측 | 이번 처리 |
|---|---|---|---|
| N4 당사자 상시 탐색(TabBar) | F(죽은 코드) | **P** — P4(#98)에서 부활·토큰화·`(participant)/layout` 마운트 | 신규 구현 아님 → **회귀 가드**(TabBar.test.tsx 기존 green) |
| N2 aria-current(AdminSidebar) | F(시각만) | **P** — P4 계약으로 aria-current 배선 | 잔여는 §6 single-aria-current(부모+서브 동일 href 이중 표기) → **Phase C** |
| G3 페이지별 metadata.title | F→진행 | **P(진입 라우트)** — `login/layout.tsx`(title '로그인', KWCAG 2.4.2 주석)·`onboarding/page.tsx`('시작하기')·`more/page.tsx`('더보기') 보유 | **닫힘(재발견)** → RED 계약 미저작. 잔여 라우트 title 감사는 B/C 웨이브 |
| G4 헤딩 순서(login·/more h1→h3) | F | **부분** — login·/more 는 h1→h2(green). onboarding `profile`/`complete` 스텝만 h1 부재 | onboarding heading 만 **Phase A RED** |
| G1/A1 skip-link 목적지 main | F→진행 | `/more` 등은 `<main id=main-content>` 보유, **login·onboarding 진입 화면은 div 래퍼(부재)** | login·onboarding **Phase A RED** |
| LiveRegionProvider | (§4 계약) | 이미 **전역 마운트**(`app/layout.tsx`) | 프리미티브는 실존 → **소비자 배선(Phase B)** |

정정 결론: **Phase A 실제 RED = (1) 대비 토큰화 8파일 + (2) login·onboarding landmark(main#main-content) +
(3) onboarding heading 계층**. metadata·/more·TabBar 는 이미 닫힘/회귀 가드.

---

## 1. 적용 범위 & 계약 계층

krds `§2`(스타일·폼·모달·탐색·알림·버튼·기본/서비스 패턴)를 P6 로 실행한다. 계약은 **두 계층 병행**:

1. **jsdom render + jest-dom** — 행위·ARIA·구조 단언: landmark(main/nav) 유일성·`aria-current` 유일성·
   `aria-required`/`aria-invalid`+`describedby`·`role=alert`/`status` announce·`role=dialog`+`aria-modal`·
   포커스 이동/복원·Esc/오버레이·scroll-lock·`aria-expanded` 토글·heading 레벨 시퀀스·listitem 개수·
   touch className(min-h/min-w-[44px]).
2. **`tokenFoundation.test.ts` fs-scan** — 대비/토큰: 저대비 raw 팔레트 금지(`RAW_SCALE`/`RAW_WHITE`).

**하드 RED 금지(도구 한계) → §5 수동 스윕**: `focus-visible` outline 실렌더·강제 `:hover`/`:focus` 색 대비·
computed `line-height` 1.85·computed 44px 실측·모달 focus trap 의 브라우저 native Tab 순환·픽셀 4.5:1 실측은
jsdom/픽셀 한계라 자동 계약으로 만들지 않는다.

---

## 2. krds §2 → P6 계약 매핑

| krds § | 항목 | Phase | 계약 방식 | 이번 저작? |
|---|---|:--:|---|:--:|
| S4 | 대비 4.5:1(보조문구) | **A** | fs-scan(TOKENIZED_FILES 등재) | ✅ |
| G1/A1 | skip-link 목적지 main#id | **A** | render(#main-content·role=main) | ✅ |
| G2 | main 단일 | **A** | render(querySelectorAll('main')===1) | ✅(회귀+신설) |
| G4 | 헤딩 레벨 시퀀스 | **A** | render(getAllByRole heading level) | ✅(onboarding) |
| S5/S6 | 색 단독 의존·축소텍스트 | B | fs-scan(비색 큐·aria-hidden) | ⬜ |
| F1~F5 | 폼 label·required·invalid·fieldset | B | render(FormField 소비자 리트로핏) | ⬜ |
| M1~M3 | 모달 dialog·focus·Esc·scroll-lock | B | render(Modal 소비자 리트로핏) | ⬜ |
| A1 | status/alert announce | B | render(LiveRegion+useToast 배선) | ⬜ |
| N1/N3 | nav 이름·aria-expanded | C | render | ⬜ |
| N2 | single aria-current(잔여) | C | render(length===1) | ⬜ |
| B1 | 터치 44px | C | fs/className 프록시 | ⬜ |
| B2/B4 | 아이콘 라벨·이모지 aria-hidden | C | render+fs | ⬜ |
| B3 | 새 창 링크 표시 | C | render(‘(새 창)’) | ⬜ |
| SV/landmark | supporter 드로어 중복 landmark | C | render | ⬜ |

**이번 커밋 = Phase A 첫 배치만.** B/C 는 A 초록화 후 별도 웨이브로 저작(과대 RED 방지).

---

## 3. Phase A — 대비 토큰화(raw → 시맨틱 토큰)

**메커니즘(test-first 대비 계약의 핵심)**: `tokenFoundation.test.ts` 의 `TOKENIZED_FILES` 에 파일을
등재하는 순간, `RAW_SCALE`(팔레트×50~950, `bg|text|border|ring|…` prefix)·`RAW_WHITE` 정규식이 해당
파일의 raw 클래스를 **즉시 RED** 로 잡는다. U 가 시맨틱 토큰으로 치환하면 green — 픽셀 실측 없이 AA 보장의
**실효 프록시**다(시맨틱 토큰은 #89 에서 AA 검증됨).

**이번 배치(진입·전역 내비 8파일)** — 모두 저대비 raw 보유 확인(main=b2f47b1):

| 파일 | 대표 raw(저대비) | → 시맨틱 토큰 |
|---|---|---|
| `components/layout/AdminSidebar.tsx` | `text-white/60`·서브토글 raw | `text-muted-foreground` 계열 / 전역 focus-visible |
| `components/layout/MoreMenuClient.tsx` | `text-zinc-400/500`·`bg-zinc-50` | `text-muted-foreground`·`bg-muted`/`bg-card` |
| `app/(auth)/login/page.tsx` | `text-zinc-400/500`·`bg-white`·`ring-zinc-200`·`focus:ring-zinc-400` | `text-muted-foreground`·`bg-card`·`ring-border`·(focus 제거→전역 위임) |
| `app/onboarding/OnboardingClient.tsx` | `text-zinc-400/500`·`bg-white`·`ring-zinc-200` | `text-muted-foreground`·`bg-card`·`ring-border` |
| `app/(participant)/more/page.tsx` | `text-zinc-400/800`·`bg-zinc-*` | `text-muted-foreground`·`text-foreground`·`bg-muted` |
| `app/(participant)/receipt/ReceiptClient.tsx` | `text-zinc-400/500`·상태색 raw | `text-muted-foreground`·`text-*-foreground` 토큰 |
| `app/(supporter)/admin/settings/page.tsx` | `text-zinc-*`·`bg-*-50`·`ring-*-200` | 시맨틱 surface/텍스트 토큰 |
| `app/(supporter)/admin/participants/page.tsx` | `text-zinc-*`·`bg-white` | `text-muted-foreground`·`bg-card` |

**토큰표 규칙(#89 검증 팔레트 기준)**
- 보조/설명문구 `text-zinc-400/500` → **`text-muted-foreground`** (흰 배경 ~2.4~2.85:1 → AA 통과).
- 본문 `text-zinc-700/800/900` → **`text-foreground`**.
- 카드/표면 `bg-white` → **`bg-card`**, `bg-zinc-50/100` → **`bg-muted`**.
- 경계 `border-zinc-200`·`ring-zinc-200` → **`border-border`·`ring-border`**.
- `focus:ring-zinc-400`(제거) → **전역 `:focus-visible` 위임**(`ring-input` 은 src 전역 0회로 실존하지
  않음 — 정본은 `ring-border` + 전역 focus-visible, `globals.css` 는 U 레인 별도).
- 잔여 ~51 파일은 **B/C 웨이브**로 `TOKENIZED_FILES` 확장(이번엔 진입·내비 8개만).

> `globals.css`(raw 3회)는 CSS 파운데이션이라 fs-scan 대상 아님(U 레인 토큰 정의부).

---

## 4. Phase A — landmark / heading 계약 (render)

계약 파일:
- `src/app/(auth)/login/page.p6.test.tsx`
- `src/app/onboarding/OnboardingClient.p6.test.tsx`

| 계약 | 단언 | RED 근거(b2f47b1) | U 초록화 |
|---|---|---|---|
| login skip-link 목적지 | `#main-content` 존재 · `getByRole('main')` 단일 · 목적지 tagName===main | login page.tsx 는 `<div className="flex min-h-screen …">` 래퍼만 | 진입 컨테이너를 `<main id="main-content" tabIndex={-1}>` 로 승격 |
| onboarding skip-link 목적지 | `#main-content` 존재 · main 단일 | OnboardingClient 최상위가 div 래퍼 | 동일 승격 |
| onboarding heading 계층 | 초기 `role` 스텝 h1 1개(**baseline green 가드**) / `profile` 스텝 이동 후에도 h1 1개 | `profile` 스텝은 '…프로필 설정' 을 **h2 로 시작**(h1 부재) → 레벨 도약 | 스텝 제목 h1 승격 또는 화면 상단 지속 h1 |

**전역 skip-link 근거**: `app/layout.tsx` 가 `<a href="#main-content">본문 바로가기</a>` 를 상시 렌더.
각 진입 화면이 목적지 `main#main-content` 를 제공해야 skip-link 가 죽지 않고 main 랜드마크(8.1.1)도 성립.

**단일 main 회귀 가드**: login·onboarding 은 현재 0개 → 신설로 `===1`. 이미 green 인 대표 화면
(`(participant)` 홈·`/more`)은 P4 에서 확보된 단일 main 을 유지 — 서버/레이아웃 렌더 제약으로 이 배치의
자동 계약엔 넣지 않고 §5 접근성 트리 스윕으로 회귀 확인.

**force-merge 금지**: 모두 구조 승격(래퍼→main, h2→h1)으로 초록 — 리다이렉트/삭제 아님.

---

## 5. 자동 계약 밖 — 수동 DevTools 스윕 가이드 (§6 연동)

아래는 jsdom/픽셀 한계로 **하드 RED 로 만들지 않는다**. Phase A 초록화 후 실브라우저에서 실측·확정:
- [ ] 대비 4.5:1↑: 토큰 치환 후 CSS Overview + 실화면 — 잔여 배지·`text-[8~11px]`.
- [ ] `:focus-visible` outline 실렌더 가시성(전역 위임 후) · Tab 순서 논리성.
- [ ] computed `line-height` 1.85 / `font-size` 16px↑ — 대표 5화면.
- [ ] 터치 타깃 computed 44px — className 프록시(Phase C)와 교차 확인.
- [ ] 접근성 트리: **main 단일** · heading 순서 · nav 이름(회귀 확인).
- [ ] 모달 focus trap 의 브라우저 native Tab 순환(Phase B Modal 초록화 후).

---

## 6. Phase C 예고 — single aria-current 처리 (P4 계약 재정의)

`AdminSidebar` 는 부모 Link(`href=item.href`)와 서브 '전체 목록'(`href='/admin/participants'`)이 **동일
href** 라, `pathname==='/admin/participants'` 일 때 **둘 다** `aria-current='page'` 가 된다(SR 이 현재 위치를
2개로 인식). Phase C 계약: `querySelectorAll('[aria-current="page"]').length === 1`.

**규칙 재정의안(P4 aria-current 계약 위에)**: 부모는 *정확 매치가 서브에도 존재하면* aria-current 미표시
(서브만 현재) — 즉 aria-current 는 **리프에만**, 부모는 하위경로 활성-스타일만. 이 재정의는 P4 계약과
충돌하지 않도록 Phase C 에서 **명시적으로 갱신**한다(이번 웨이브 미저작).

---

## 7. easy-read 문구 계약 (§5 시드 계승)

Phase B/C 에서 신규/변경 문구는 `easy-read-review` 기준 확정. 계약에 박을 확정 문구:
- 저장 성공(status): **"저장했어요."** · 진행(status): **"사진을 읽고 있어요…"**
- 오류(alert): 무엇이·어떻게 구체적으로 — "이름을 적어 주세요.", "사진이 너무 커요. 더 작은 사진을 올려 주세요."
- 형식 힌트(help): "숫자만 적어요.", "예: 2026-08-26"
- 새 창 링크: 보이는 '↗' + `aria-label` 에 **"(새 창)"**.
- 원칙: 짧은 한 문장·능동태·다음 행동 제시. 전문용어·이중부정 금지.

---

## 8. 핸드오프 & 게이트

**핸드오프(→U, app-6c)**: 이 커밋의 Phase A RED 를 초록화한다.
1. **대비 토큰화(8파일)** — §3 표대로 raw → 시맨틱 토큰 치환(`tokenFoundation` 8 RED → green).
2. **login·onboarding landmark** — 진입 컨테이너 `<main id="main-content" tabIndex={-1}>` 승격(6 RED → green).
3. **onboarding heading** — `profile`(및 `complete`) 스텝 제목 h1 승격(1 RED → green, role 스텝 가드 유지).

**게이트**(krds §7): `npm test`(계약 초록) + `npm run lint`(jsx-a11y) + `npm run build` + CI `quality-check`.

**Open items(B/C 웨이브)**: FormField/Modal/LiveRegion 소비자 리트로핏 · nav aria-label/aria-expanded ·
single aria-current 재정의 · touch 44px · 새 창 표시 · supporter 드로어 중복 landmark · 잔여 ~51파일 토큰화.
