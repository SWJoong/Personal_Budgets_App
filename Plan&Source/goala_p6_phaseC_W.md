# GOALA P6 Phase C — 행위/ARIA 접근성 계약 (W 설계·검증 축)

> 범위: 프론트 재구성 로드맵 최종 a11y 웨이브(KRDS §2 Phase C). **test-first RED 계약만 저작**하고
> 구현(초록화)은 U 세션(app-6c 레인). 이 문서는 계약표·근거·jsdom 불가 항목 가이드·대비 sweep
> 배치플랜(별도 트랙)·겹침 rebase 안내를 담는다.
>
> **★tokenFoundation.test.ts 미변경**: 동시 진행 중인 다크토큰 브랜치가 이 파일을 편집 중이라
> 충돌 회피를 위해 이 웨이브는 `src/test/tokenFoundation.test.ts` 를 **건드리지 않는다**. 실제
> `TOKENIZED_FILES` 등록은 다크토큰 브랜치 머지 이후 별도 웨이브에서 한다.

## 0. 스코프 4축

1. **nav 완전성** — landmark(각 화면 `<main id=main-content>`)·`aria-current`·skip-link 목적지
   커버리지·heading 시퀀스(h1 유일).
2. **touch 44px** — 비-프리미티브 인터랙티브 요소가 `min-h-11`/`min-w-11`(44px) 미달.
   ★P3 프리미티브(Button/LinkButton 등)는 이미 44px 강제 → 제외, 잔여만.
3. **button/link 라벨** — icon-only 요소가 accessible name 누락 → `getByRole(...,{name})` 실패.
4. **list 시맨틱** — 반복 카드/목록이 `<div>` 나열(role 부재) → SR 항목수 안내 불가.

## 1. 계약 원칙 (단언 어휘)

- render + jest-dom **행위/ARIA** 단언만: `getByRole`/`getByLabelText`/`queryByRole`,
  `toHaveAttribute('aria-current','page'|'aria-expanded')`, `container.querySelector('#main-content')`,
  `getByRole('heading',{level:N})`, `getAllByRole('listitem').length===N`.
- **TOUCH-44 는 클래스 문자열 존재**로 단언(`className.match(/min-h-11|min-w-11|min-h-\[44px\]|min-w-\[44px\]|w-11|h-11/)`)
  — **렌더 픽셀 아님**(jsdom 은 레이아웃이 없다).
- **렌더 게이트**: `'use client'` 또는 순수 프레젠테이셔널만 `render()` 로 RED. 모듈스코프에서
  `createClient`/`createAdminClient` 를 호출하는 async 서버 페이지는 데이터계층 모킹 후
  `render(await Page())` 하거나, 목록부를 client 서브컴포넌트로 추출한다.
- **4버킷**: RED(진짜 실패·구현강제) · GUARD(이미 green 회귀락) · ALIGN(P4/P5 가 이미 커버, 재저작 금지=거짓RED 회피) · DESIGN-DOC(jsdom 표현 불가 → 가이드+클래스/ARIA 프록시).

## 2. 계약표 (파일별)

| # | 계약 | 대상 | 버킷 | 테스트 파일 |
|---|------|------|------|------------|
| 1 | error 바운더리 main#main-content + h1 | `(supporter)/error.tsx` | **RED** | `error.p6c.test.tsx` |
| 2 | participant/root 로딩 skip-link 목적지 | `(participant)/loading.tsx`·`app/loading.tsx` | **RED** | `(participant)/loading.p6c.test.tsx` |
| 3 | NavDropdown nav 랜드마크·aria-current·토글 | `layout/NavDropdown.tsx` | GUARD | `NavDropdown.p6c.test.tsx` |
| 4 | ComingSoon main#main-content·h1·홈링크 44px | `ui/ComingSoon.tsx` | GUARD | `ComingSoon.p6c.test.tsx` |
| 5 | TabBar·AdminSidebar·participant layout 셸 nav | 3파일 | ALIGN | (재저작 금지 — 아래 §4) |
| 6 | 셸 이중 h1(모바일 헤더) | `(supporter)/SupporterLayoutClient.tsx` | DESIGN-DOC | (아래 §5) |
| 7 | guide 뒤로가기 라벨+터치 | `(participant)/guide/page.tsx` | **RED** | `guide/page.p6c.test.tsx` |
| 8 | admin 백링크(서버·데이터바운드) | `admin/participants/page.tsx`·`.../new/page.tsx` | DESIGN-DOC | (아래 §5) |
| 9 | FaqButton 닫기 터치 | `ui/FaqButton.tsx` | **RED** | `FaqButton.p6c.test.tsx` |
| 10 | PlaceSearch '변경' 터치 | `map/PlaceSearch.tsx` | **RED** | `PlaceSearch.p6c.test.tsx` |
| 11 | AdminSidebar 접기 토글 터치 | `layout/AdminSidebar.tsx` | **RED** | `AdminSidebar.p6c.test.tsx` |
| 12 | 경계선 터치·title→aria-label | `SupporterLayoutClient.tsx:93`·`AdminSidebar.tsx:104` | DESIGN-DOC | (아래 §5) |
| 13 | 이미 green 라벨/터치 회귀락 | `ImageLightbox`·`Modal` | GUARD | `ImageLightbox.p6c.test.tsx` |
| 14 | review 대기열 목록 | `supporter/review/ReviewQueueClient.tsx` | **RED** | `ReviewQueueClient.p6c.test.tsx` |
| 15 | my-plan 서비스 목록 | `my-plan/MyPlanClient.tsx` | **RED** | `MyPlanClient.p6c.test.tsx` |
| 16 | 당사자 상세 3개 목록 | `admin/participants/[id]/ParticipantDetailClient.tsx` | **RED** | `ParticipantDetailClient.p6c.test.tsx` |
| 17 | 갤러리 사진 목록(async) | `(participant)/gallery/page.tsx` | **RED** | `gallery/page.p6c.test.tsx` |
| 18 | 평가/정산 목록(async) | `(participant)/evaluations/page.tsx` | **RED** | `evaluations/page.p6c.test.tsx` |
| 19 | 이미 ul/li client 목록 회귀락 | `OrgLedgerClient.tsx` | GUARD | `OrgLedgerClient.p6c.test.tsx` |
| 20 | 이미 ul/li 서버 목록 | participant home·receipt·participants·applications·plans 등 | DESIGN-DOC | (아래 §5) |
| 21 | out-of-scope role 정책 | calendar grid·NavDropdown nav목록·PlaceSearch listbox | DESIGN-DOC | (아래 §5) |

**결과**: RED 16건(모두 오늘 실패, 구조적 사유 확인) · GUARD 7건(이미 green, 회귀락) · 기존 스위트 무손상(292 pass).

## 3. RED 근거·초록화 방법 (U impl 가이드)

- **error.tsx** (line17 `<div className='flex...min-h-screen'>`, line20 `<h2>`): 루트 `<div>`→
  `<main id="main-content" tabIndex={-1}>`, `<h2>`→`<h1>`. 에러 시 전역 skip-link '본문 바로가기'
  가 살아나고 랜드마크·h1 시퀀스 정합. supporter loading 은 이미 main#main-content 보유.
- **participant/root loading** (`(participant)/loading.tsx` line4·`app/loading.tsx` line3 둘 다 `<div>`):
  루트를 `<main id="main-content" tabIndex={-1}>` 로. participant 하위 개별 loading
  (evaluations·map·gallery·calendar·more·receipt·plan·settings/profile)도 동일 패턴 권장 —
  **계약은 root 2파일만 잠그고 나머지는 lint/design-doc 가이드**(전량 RED 는 과함).
- **guide 뒤로가기** (line40 `<Link href='/' className='…text-2xl'>←</Link>`): P3 `LinkButton`
  iconOnly 프리미티브로 교체(44px+aria-label 자동 강제) 또는 `aria-label='뒤로 가기' + min-h-11 min-w-11`.
  ★테스트는 헤더로 scope 하여 하단 '확인했어요! 홈으로 가기' CTA(이미 green)와 구분한다.
- **FaqButton 닫기** (line20 `w-8 h-8` + aria-label='닫기'): `w-8 h-8`→`min-h-11 min-w-11`(또는 `w-11 h-11`). 라벨 유지.
- **PlaceSearch '변경'** (line71 `px-2 py-1 text-xs`): `min-h-11` 부여(패딩 조정). line90 '검색'은 이미 44px green.
- **AdminSidebar 토글** (line105 `w-8 h-8`): `min-h-11 min-w-11`. line104 `title='…'`→`aria-label` 승격 권장(§5).
  ★**다크토큰 브랜치와 impl 파일 겹침** → U impl 은 다크토큰 머지 후 **rebase** 필요(계약=신규 test 라 무겹침).
- **list RED**: 컨테이너 `<div>`→`<ul>`, 반복 카드 `<div>`/`<article>`→`<li>`.
  - ReviewQueueClient(line53/58): 에러 배너는 `<li>` 밖.
  - MyPlanClient(line261 filledServices): line248 NARRATIVE_FIELDS 는 폼필드 맵→제외.
  - ParticipantDetailClient(line186/237/268): `Card as='li'` + 각 섹션 `<ul>`. 각 '추가' 폼 Card·상단 stat 그리드는 리스트 밖.
  - gallery/evaluations(async): `render(await Page())` + supabase/actions 모킹으로 RED 확인.
    U 는 (a) await Page()+mock 유지하며 ul/li 승격, 또는 (권장) 목록부 client 서브컴포넌트 추출.
    gallery 는 figure/figcaption 시맨틱 채택도 허용(그 경우 계약을 `getAllByRole('figure')` 로 조정 요청).

## 4. ALIGN — 재저작 금지(거짓 RED 함정 회피)

`TabBar`·`AdminSidebar`·`(participant)/layout` 의 **nav landmark/aria-current/aria-expanded 는
P4/P5/P6-A 가 이미 구현·테스트**했다: `TabBar.test.tsx`(nav '메인 네비게이션'+활성탭 aria-current),
`AdminSidebar.test.tsx`+`.p5.test.tsx`(nav '주요 메뉴'+aria-current+aria-expanded),
`(participant)/layout.test.tsx`(TabBar 마운트). 스펙 전제 "login/onboarding 만 main#main-content"
는 **outdated** — 전 콘텐츠 page 에 이미 main#main-content, 셸에 nav landmark 가 깔려 있다.
→ 이 셸 nav 를 RED 로 거는 것은 이미 통과라 **거짓 RED**. 재확인만, 신규 단언 없음.
(NavDropdown 의 NAV_ITEMS `<div>` 링크 나열은 **nav 트랙 소유**이며 content-list 웨이브 밖 — 중복 계약 금지.)

## 5. DESIGN-DOC — jsdom 표현 불가 항목 가이드

- **셸 이중 h1**(SupporterLayoutClient line74 모바일 헤더 `<h1>서울형 개인예산제</h1>`): 미디어쿼리
  미적용이라 `md:hidden` 헤더와 페이지 h1 이 격리 렌더로는 안 잡힘. **권고: 모바일 헤더 제목을
  h1→p/span 강등** → 셸+페이지 합성 시 단일 h1 보장. AdminSidebar 브랜드 `<h2 line97>` 포함
  **셸 heading 정책**: "브랜드는 비-heading 또는 aria-hidden, 페이지가 유일 h1".
  프록시 계약(선택): SupporterLayoutClient 격리 render 시 모바일 헤더 제목이 heading role 이
  아님을 단언.
- **admin 백링크**(participants/page.tsx:50 async 서버·new/page.tsx:89,102 supabase 의존): guide 와
  동일 결함이나 렌더 게이트 미충족. **권고: 4개 ← (guide 포함)을 공용 LinkButton iconOnly 로 추출**
  → 한 곳 수정으로 label+touch 동시 해결. guide RED 가 프리미티브 채택을 강제하는 대표 계약.
- **경계선 터치/title**: SupporterLayoutClient line93 '메뉴 닫기'(`p-2 text-lg`, aria-label green 이나
  ~44px 경계) → `min-h-[44px]` 클래스 부여 가이드. AdminSidebar line104 collapse `title`→`aria-label`
  승격(title 은 SR 접근명으로 약함).
- **이미 green 서버 목록**(participant home budgetRows/recentUsages·receipt spendingRules/placeResults/usages·
  당사자목록·신청·계획·초대·거래): 모두 이미 ul/li 이나 async 서버라 GUARD 렌더 불가 →
  lint룰/설계문으로 '반복 목록은 ul/li' 커버리지 방어.
- **role 정책 경계선**: calendar 셀은 `grid`/`gridcell` 정본(listitem 아님; line122 하루 지출목록만
  선택적 list-RED 후보), NavDropdown 목록은 nav 트랙, PlaceSearch 검색결과는 `combobox`/`listbox`(option)
  정본 → content-list RED 에서 제외.

## 6. ★대비(contrast) sweep 배치플랜 — **별도 기계적 트랙**(이 웨이브 계약 아님)

이 워크플로는 **코드를 저작하지 않고 tokenFoundation.test.ts 를 편집하지 않는다**(다크토큰 브랜치
소유). 실제 `TOKENIZED_FILES` 등록은 그 브랜치 머지 **이후** 별도 웨이브. 측정 인벤토리
(tokenFoundation raw-palette regex, RAW_SCALE 22팔레트×11스케일 + RAW_WHITE):
**미토큰화 87파일 / raw hit 1327건**(W 의 ~51 추정보다 많음). AdminSidebar 는 이미 토큰화(다크 브랜치)—제외.

- **BATCH 1 — 로딩 스켈레톤 15파일(~203 hits)**: (participant)/{calendar,evaluations,gallery,map,more,
  plan,receipt,settings/profile,root}/loading + app/loading + (supporter)/admin/{,participants,
  participants/[id]}/loading + supporter/{review,transactions/[id]}/loading. 순수 bg-zinc/animate-pulse,
  행위 리스크 0 → **선순위 sweep**.
- **BATCH 2 — 공유 컴포넌트 17파일(최고 재사용 레버리지)**: admin/ParticipantHomePreviewClient(56, 최다)·
  PreviewBanner · help/{AdminHelpButton,AdminHelpModal,HelpButton,HelpSlideshow} · home/WaterCupPlanPreview ·
  layout/{NavDropdown,NavigationProgress} · map/{KakaoMap,PlaceSearch} · ui/{ComingSoon,FaqButton,FormField,
  ImageLightbox,Modal,SelfCheckFeedback}. **★겹침경고**: ui/FormField·Modal·ImageLightbox·SelfCheckFeedback·
  ComingSoon 은 Phase B(폼/모달 retrofit) 와, layout/NavDropdown·NavigationProgress·FaqButton 은 Phase C
  nav/touch 트랙과 충돌 → **색 토큰 치환만**, ARIA/구조는 각 phase 계약에 위임(rebase-coordinate).
- **BATCH 3 — participant 화면 17파일(Easy-Read 우선)**: my-plan/MyPlanClient(39)·map/MapTabsClient(26)·
  settings/profile/ProfileEditClient(23)·evaluations/page(23)·calendar/CalendarClient(21)·guide/page(15)·
  plan/page(14)·gallery/page(14)….
- **BATCH 4 — supporter/admin 35파일**: 4a(transactions/applications/plans/network/review) vs
  4b(assessment/evaluation/settings). 헤비: EvaluationClient(55)·assessment(47)·NewTransactionClient(41)·
  ApplicationDetailClient(51). 4a/4b 분할 권장.
- **미분류/수동검토 3**: (auth)/layout.tsx·app/layout.tsx·utils/budget-visuals.ts(**JSX 아님** — 클래스
  문자열 반환, regex 는 걸리나 토큰 매핑 수동 필요 → auto-sweep 제외).

**★list-RED + 대비 동시대상**(U 는 한 편집에서 list 승격 + 토큰 치환): evaluations/page·
my-plan/MyPlanClient·ReviewQueueClient·ParticipantDetailClient·gallery/page.

## 7. 겹침·rebase 요약

- **AdminSidebar**: 다크토큰 브랜치와 impl 겹침 → 다크토큰 머지 후 rebase.
- **ui/FormField·Modal·ImageLightbox·ComingSoon·SelfCheckFeedback**: Phase B 와 겹침 → 색만 sweep.
- **NavDropdown·NavigationProgress·FaqButton**: Phase C nav/touch 와 겹침 → 구조는 이 계약, 색은 sweep.
- 모든 P6-C **계약 파일은 신규 test** 라 파일 겹침 없음. impl 만 rebase 좌표 관리.
