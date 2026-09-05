# P7 웨이브3 — 빈 상태·로딩·에러 일관화 + 갤러리 정체성 (설계·계약)

> 저자: W(설계·검증 축). 구현: U. test-first — 이 문서 + RED 계약이 스펙을 못 박고 U 가 초록으로 만든다.
> 감사 근거: 웨이브3 evidence A1·A2·A3·A4·A7·A8·A9 + ★갤러리(사용자 결정).
> 게이트: `npx vitest run`(신규 9파일 RED, 기존 무손상) + `npx tsc --noEmit`(초록). easyread MCP verdict=pass.

---

## 0. 범위 요약

| 항목 | 문제 | 해법 | 계약 유형 |
|---|---|---|---|
| A1 | 당사자 목록 6종이 EmptyState 미채택(인라인 `<p …없어요>`) | EmptyState 채택 | RED-fsscan |
| A2 | 실무자 목록 6종 미채택 + 빈상태 다음행동 CTA 부재(데드엔드) | EmptyState + action CTA | RED-fsscan (+ OrgLedger jsdom) |
| A3 | 실무자 목록 라우트 loading.tsx 부재 → fetch 중 빈화면 | loading.tsx 7종 | RED-fsscan(존재) + RED-jsdom(렌더) |
| A4 | (participant) error.tsx 부재 → 오류 시 미다듬은 화면 | error.tsx 신설 | RED-jsdom(존재+렌더) |
| A7 | no-budget 게이트 문구 7파일 하드코딩 중복 | NoBudgetGate 공유 컴포넌트 | RED-jsdom(unit) + RED-fsscan(채택) |
| A8 | 빈상태 emoji aria-hidden 불일치 | EmptyState/NoBudgetGate 가 구조적으로 aria-hidden | (A1/A7 에 흡수) |
| A9 | 화면레벨 빈데이터→EmptyState 골든 부재 | fsscan + client jsdom 로 회귀 잠금 | (본 계약 전체) |
| ★갤러리 | 이름 3중 불일치 + 정렬 전무 | 이름 통일 + 결정적 정렬 | RED-fsscan(이름) + RED-jsdom(정렬) |

**계약 파일(9종, redCount=86)**
- `src/app/(participant)/emptystate.adopt.p7c.test.ts` — 당사자 6종 채택(fsscan)
- `src/app/(supporter)/supporter/emptystate.adopt.p7c.test.ts` — 실무자 6종 채택 + action(fsscan)
- `src/app/(supporter)/supporter/transactions/OrgLedgerClient.filterzero.p7c.test.tsx` — 필터0 description(jsdom)
- `src/app/(supporter)/supporter/loading.p7c.test.tsx` — loading 7종 존재+렌더
- `src/app/(participant)/error.p7c.test.tsx` — 당사자 error 존재+렌더
- `src/components/ui/NoBudgetGate.test.tsx` — 공유 컴포넌트 unit
- `src/app/(participant)/nobudget.adopt.p7c.test.ts` — 게이트 채택 7종(fsscan)
- `src/app/(participant)/gallery/gallery.naming.p7c.test.ts` — 갤러리 이름(fsscan)
- `src/app/(participant)/gallery/gallery.sort.p7c.test.tsx` — 갤러리 정렬(jsdom)

**재사용 프리미티브(신규 인프라 없음)**
`EmptyState({emoji?, title, description?, action?: {label,href}|ReactNode, variant?: 'full'|'inline'})` —
action `{label,href}` → `min-h-44px` next/link(role=link), ReactNode → 그대로, 생략 → 컨트롤 없음.
emoji 는 `aria-hidden` 장식 span. 계약: `src/components/ui/EmptyState.test.tsx`(기존, 초록).

---

## 1. EmptyState 채택 매핑 — 당사자 목록 6종 (A1)

계약: `emptystate.adopt.participant-lists`(fsscan) = 각 파일 ①EmptyState import ②`<EmptyState` 사용
③`<p …(text-muted-foreground|py-8|py-12)…없어요>` 인라인 잔여 0.

| 파일 | 빈 지점 | STATE | title | description | action |
|---|---|---|---|---|---|
| `(participant)/page.tsx` L272 | 지출 목록 0 | 1(진짜0) | `아직 쓴 돈이 없어요.` | — | `{처음으로 돈을 써 보세요, /receipt}` |
| `(participant)/page.tsx` L155 | 배정 예산 없음(`!balance`) | 대기 | `아직 정해진 예산이 없어요.` | `선생님들이 확인하면 여기에 나와요.` | 없음(대기) |
| `(participant)/page.tsx` L81 | no-budget 게이트 | 3 | → **NoBudgetGate**(§5) | | |
| `calendar/CalendarClient.tsx` L120 | 선택 날짜 지출 0 | 필터0 | `이 날은 쓴 돈이 없어요.` | (선택) `다른 날짜를 눌러보세요.` | 없음 |
| `plan/page.tsx` L67 | 해보고 싶은 것 0 | 1 | `아직 없어요.` → `아직 적은 것이 없어요.` | — | `{이용계획에서 적어요, /my-plan}`(기존 유지) |
| `gallery/page.tsx` 본문 빈 | 사진 0 | 1 | `아직 사진이 없어요.` | `지출을 기록할 때 사진을 함께 남겨보세요.` | 없음 |
| `my-plan/MyPlanClient.tsx` L173 | 계획 없음 | 대기 | `아직 계획이 없어요.` | `담당 선생님이 함께 계획을 만들 거예요.` | 없음(선생님 몫) |
| `my-plan/MyPlanClient.tsx` L259 | 서비스 0 | 1 | `아직 정해진 서비스가 없어요.` | — | 없음 |
| `map/MapTabsClient.tsx` L95 | 발견 목록 0 | 필터0/1 | `쓸 수 있는 곳이 아직 없어요.` (domain 필터 시 `이 영역에서 쓸 수 있는 곳이 아직 없어요.`) | — | 없음 |

메모:
- calendar 의 `이 날은 쓴 돈이 없어요` 도 목록레벨 빈상태 → EmptyState 로 이동(fsscan 이 인라인 잔여를 잡는다).
- 당사자 client(my-plan/map/calendar) 은 **CTA 가 없어** role=link 기반 jsdom RED 가 성립하지 않는다 →
  fsscan 으로 채택을 잠근다(선례: P6-C 가 calendar 상호작용 골든을 피한 것과 동일 판단).
  업그레이드 경로: U 가 빈 분기를 프레젠테이셔널 서브컴포넌트로 추출하면 W 가 render 골든을 부착한다.
- map 은 `KakaoMap` 이 `window.kakao` 전역을 요구 → 향후 jsdom 부착 시 `vi.mock('@/components/map/KakaoMap')`.

---

## 2. EmptyState 채택 매핑 — 실무자 목록 6종 (A2) + CTA href 맵

계약: `emptystate.adopt.supporter-lists`(fsscan) = import + 사용 + 인라인 잔여0 +
**NEEDS_ACTION 5종은 `action=` 배선 필수**(데드엔드 제거). documents 는 action 선택.

| 파일 | STATE | title | description | action `{label, href}` |
|---|---|---|---|---|
| `transactions/page.tsx`(서버, rows 0) | 1(진짜0) | `아직 지출 기록이 없어요.` | — | `{당사자 보러 가기, /supporter/participants}` |
| `participants/page.tsx` | 1 | `아직 등록된 당사자가 없어요.` | — | `{당사자 추가하기, /admin/participants/new}` |
| `plans/page.tsx` | 1 | `아직 작성된 이용계획이 없어요.` | — | `{새 계획 만들기, /supporter/plans/new}` |
| `applications/page.tsx` | 1 | `아직 접수된 신청서가 없어요.` | — | `{새 신청서 접수, /supporter/applications/new}` |
| `evaluations/page.tsx` | 1 | `아직 등록된 당사자가 없어요.` | — | `{당사자 보러 가기, /supporter/participants}` |
| `documents/DocumentShelfClient.tsx`(client) | 1 | `아직 등록된 서류가 없어요.` | (선택) | 없음/선택(서류 업로드 전용 라우트 부재 — 소프트 CTA `/supporter/participants` 허용) |

메모:
- participants/plans/applications/evaluations 는 이미 L1 에 `Link` import → **action prop 만** 추가.
- transactions 는 `Link` import 없음 — EmptyState 가 내부적으로 next/link 를 렌더하므로 `action` prop 만 배선.
- href 는 실측 라우트 기반(plans/new·applications/new 존재, participants 추가는 admin 경로).
  U 가 role 게이팅(관리자 전용 추가)으로 href 를 조정할 수 있다 — fsscan 은 `action=` **존재만** 잠근다.
- `transactions/OrgLedgerClient.tsx` 는 이미 EmptyState 채택(필터0) — §3 에서 별도 잠금(회귀 방지).

---

## 3. 빈 상태 3구분 easy-read 문구 표준 (W 소유, easyread MCP verdict=pass)

발달장애 당사자 명확성 원칙: 짧은 문장, **동사 살리기(명사화 금지, SEN-07)**, 항상 '다음에 무엇을 할지' 제시.
※ easyread notice: 이 표준은 당사자 직접 감수를 대신하지 않는다 — 최종본은 당사자 감수 + 그림/사진 병기 권장.

### STATE 1 — 첫사용/진짜0 (데이터가 아직 없음, 온보딩)
무엇이 없는지 + **다음 행동 CTA(action {label, href})**. EmptyState 는 반드시 role=link CTA 포함.
- 당사자 지출0: `아직 쓴 돈이 없어요.` / CTA `처음으로 돈을 써 보세요` → `/receipt`
- 실무자 목록 진짜0: `아직 <대상>이 없어요.` / CTA `<대상> 추가하기`(또는 `만들기/접수`) — §2 href 맵.

### STATE 2 — 필터결과0 (데이터는 있으나 조건에 안 걸림)
다음 행동 = '조건 변경' 자체 → **description 필수**, 별도 CTA link 는 선택(리셋 컨트롤 허용).
- 표준: title `조건에 맞는 결과가 없어요.` / description `조건을 바꿔서 다시 찾아보세요.`
- 구체형(권장): `고른 조건에 맞는 <내용>이 없어요.` / `조건을 바꿔서 다시 찾아보세요.` — `<내용>`을 실제 명사로 치환.
- **기준 예제**: `transactions/OrgLedgerClient` status 필터0 → EmptyState `description=/조건을? 바꿔/`
  (오늘 description 부재 → RED). 이 화면이 canonical 3상태 예제: 서버페이지=진짜0, 이 client=필터0.
- SEN-07 회피: `찾는 것이 없어요`(명사화, warning) **폐기** → `조건에 맞는 결과가 없어요`(pass) 채택.

### STATE 3 — no-budget 게이트 (예산/배정 없음)
**NoBudgetGate 공유 컴포넌트로 통일**(§5). 이모지는 장식 → 강제 aria-hidden(A8 해소). 헤더 제목은 화면별 유지.
- 예산 없음: title `아직 예산 정보가 없어요.` / 본문 `담당 선생님에게 말해 주세요.`
  (원문 `말씀해 주세요` → `말해 주세요` easy-read 단순화)
- 배정 없음(ReceiptClient): title `아직 예산이 정해지지 않았어요.` / 동일 본문 — title prop 로 분기.
  (통일 여부 W easy-read 최종결정 대기 — 컴포넌트는 title prop 로 어느 쪽이든 표현 가능)

**easyread MCP 결과(2026-09-05)**: 위 STATE 1/2/3 대표 문구 전부 `verdict=pass`(errors 0, warnings 0).

---

## 4. loading / error 대칭 (A3·A4)

### loading.tsx — 실무자 목록 7종 (A3)
계약: `loading.exists`(fsscan 존재) + `loading.render`(jsdom `#main-content` + `.animate-pulse` ≥1).
대상 7종: `transactions · participants · plans · applications · evaluations · network · documents`.
- **budgets 제외**: `supporter/budgets/` 는 목록 page.tsx 가 없고 `[id]` 상세만 존재(목록 로딩 불필요).
- 모양 템플릿: `admin/participants/loading.tsx`(헤더 + 요약카드 + 리스트 스켈레톤, `#main-content` 포함) 복제.
- 불변식: 전역 skip-link `본문 바로가기` 목적지 `#main-content` 가 로딩 중에도 살아있어야 함(P6-C).

### error.tsx — (participant) 라우트그룹 (A4)
계약: `error.participant.exists-and-render`(fsscan 존재 + jsdom).
- 신설 `src/app/(participant)/error.tsx` — `(supporter)/error.tsx` 를 당사자 easy-read 톤으로 이식.
- 불변식(단언): `main#main-content` 랜드마크 + `h1`(유일, 앞에 h2 시작 금지) + 복구 버튼(`다시 시도`).
- 문구·색·토큰은 단언하지 않음 — h1 문구(`화면을 열 수 없어요` 류)는 W easy-read 소유. `'use client'` + `reset()`.

---

## 5. NoBudgetGate 공유 컴포넌트 (A7·A8)

### 시그니처
```ts
NoBudgetGate({
  title: string,                        // '예산 정보가 없어요' vs '예산이 정해지지 않았어요' 를 화면별 분기
  emoji?: string,                       // 장식 → 강제 aria-hidden (A8)
  body?: string,                        // 기본값 = STATE 3 표준 '담당 선생님에게 말해 주세요.'
  action?: { label: string, href: string },  // 제공 시 role=link CTA (없으면 컨트롤 없음)
  variant?: 'page' | 'inline',          // 'page' = main#main-content 랜드마크 포함, 'inline' = 카드만
})
```
계약: `nobudget.gate.unit`(jsdom) — title/기본본문 렌더 · emoji aria-hidden · variant 별 랜드마크 유무 ·
action → role=link(href 일치) / 생략 → 컨트롤 없음. 단언 범위: 문구·랜드마크·aria-hidden·role 만.

### 채택 매핑 — 7파일 (A7)
계약: `nobudget.gate.adopt`(fsscan) — 각 파일 NoBudgetGate import + `<NoBudgetGate` 렌더 +
게이트 원문 `담당 선생님에게 말씀해 주세요` 가 NoBudgetGate.tsx 밖 src 전체에서 **0회**(컴포넌트가
`말해 주세요`로 단순화 → 원문 완전 소멸).

| 파일 | title prop | variant | 헤더 제목(유지) |
|---|---|---|---|
| `(participant)/page.tsx` L81 | `아직 예산 정보가 없어요.` | page | (홈 헤더) |
| `(participant)/calendar/page.tsx` L23 | `아직 예산 정보가 없어요.` | page | `달력` |
| `(participant)/gallery/page.tsx` L23 | `아직 예산 정보가 없어요.` | page | `활동 사진`(§6 리네임) |
| `(participant)/map/page.tsx` L26 | `아직 예산 정보가 없어요.` | page | (지도 헤더) |
| `(participant)/my-plan/page.tsx` L23 | `아직 예산 정보가 없어요.` | page | `이용계획` |
| `(participant)/receipt/page.tsx` L24 | `아직 예산 정보가 없어요.` | page | (영수증 헤더) |
| `(participant)/receipt/ReceiptClient.tsx` L175 | `아직 예산이 정해지지 않았어요.` | inline | (배정 없음 분기) |

메모: **헤더 제목은 화면별 유지** — 공유 대상은 게이트 '본문'만. 각 화면 헤더/`<main>` 래퍼는 그대로 두고
게이트 본문 블록만 `<NoBudgetGate>` 로 치환(page 변형은 자체 `main#main-content` 를 제공하므로,
치환 시 기존 헤더+main 구조와 중복되지 않게 U 가 배치 — 대부분 게이트 화면은 헤더만 남기고 본문 전체를 게이트로).
`supporter/budgets/[id]/page.tsx` 의 기존 `EmptyState title='아직 예산이 정해지지 않았어요.'` 는
**별개**(실무자 예산 상세, 이미 EmptyState 채택) — 이 게이트 채택 대상 아님(원문 `말씀` 미포함이라 fsscan 무영향).

---

## 6. 갤러리 정체성 — 이름 통일 + 결정적 정렬 (★사용자 결정)

사용자 결정: "활동 사진 우선 + 영수증 사진 후순위, 영수증만 찍었으면 영수증만" · 이름 `활동 사진` 통일.
현동작 실측(Study C): `gallery/page.tsx` 는 `seoul_receipts`(receipts 버킷)만 소스 → 사실상 모두 영수증.
활동사진 소스는 seoul 스키마 **부재**(`activity-photos` 버킷은 `06_storage.sql` 정의만, src read/write 없음).
정렬 `.order()` **전무**(비결정). 이름 3중 불일치: 메뉴/metadata=`활동 사진` vs 헤더×2/alt=`영수증`.

### 6-1. 이번 웨이브 범위 (잠금 가능)
- **이름 통일** `gallery.naming`(fsscan): 헤더 `영수증 모아보기`→`활동 사진`(L19 무참여자·L60 본문),
  alt 활동중심(`${desc} 영수증` → `${desc}` 또는 `${desc} 사진`), 빈상태 `사진` 기준.
  회귀락: `uiPreferences.ts`·`ui-preferences.ts` 는 여전히 `활동 사진` 라벨(드리프트 방지).
- **결정적 정렬** `gallery.sort`(jsdom): `usage_date` **최신순**(newest first). receipts 는 자체 날짜가
  없으므로 조인된 usage_date 로 최종 `validPhotos` 를 정렬(위치는 U 재량 — 쿼리 `.order` 또는 JS sort).
  fixture(u1 2026-09-01 < u2 2026-09-02) → 첫 listitem 이 u2. receipt-only 안에서도 유효한 실동작 개선.

### 6-2. 범위 밖 — 2소스 우선순위 (design-doc, `gallery.two-source-priority`)
- 사용자 결정 기록: **활동사진 우선 + 영수증 후순위**; **영수증만 찍었으면 영수증만**(현 receipt-only 와 이미 일치).
- 공백: seoul 모델에 활동사진 테이블/쓰기 경로 없음 → 활동사진 우선순위를 검증할 fixture 자체가 불가능.
- 따라서 웨이브3 는 **이름 + 정렬만** 잠근다. 2소스 우선순위/폴백은 **신규 백엔드 소스 필요** → 별도
  P/backend 항목으로 W 설계 대기. '영수증만이면 영수증만' 절은 소스 생기기 전 no-op(현 동작이 이미 충족).
- **소스 신설 시 붙일 jsdom 계약 형태(미리 명세)**:
  fixture = 활동사진 2장(a1<a2) + 영수증 1장(r1) → 렌더 순서 `[a2, a1, r1]`(활동사진 date-desc 우선 →
  영수증 폴백). 활동사진 0 + 영수증 N → 영수증만(현 동작). 활동사진 N + 영수증 0 → 활동사진만.
  이 계약은 `activity-photos` 읽기 경로가 src 에 생기는 즉시 활성화.

---

## 7. 서버 컴포넌트 수동 QA (jsdom 불가 화면)

async RSC(라이브 Supabase fetch)는 render 로 잠글 수 없어 **fsscan + 이 설계문**이 정본이다.
U 구현 후 아래를 대시보드/로컬 dev 에서 육안 확인(자동화 아님):

| 화면 | 확인 |
|---|---|
| `(participant)/page.tsx` | 지출0/배정없음/no-budget 세 분기가 각각 EmptyState·NoBudgetGate 로 렌더 |
| `(participant)/plan·gallery/page.tsx` | 빈 데이터 시 EmptyState(제목+필요시 CTA), 갤러리 헤더 `활동 사진` |
| `supporter/{participants,plans,applications,evaluations}/page.tsx` | 진짜0 시 EmptyState + CTA(§2 href) 클릭 이동 |
| `supporter/{7종}/loading.tsx` | 느린 네트워크(devtools throttle)에서 스켈레톤 노출, skip-link 동작 |
| `(participant)/error.tsx` | 강제 throw 시 다듬어진 화면 + `다시 시도` 복구 |

**업그레이드 경로**: U 가 각 RSC 의 빈 분기를 프레젠테이셔널 client 서브컴포넌트로 추출하면
W 가 화면별 RED-jsdom render 골든(getByText + CTA href)으로 승격한다.

---

## 8. 게이트 요약

- `npx vitest run`: 신규 9파일 = **86 RED**, 기존 66파일/489 테스트 무손상, skipped 0.
- `npx tsc --noEmit`: 초록(미존재 모듈 NoBudgetGate·participant error 는 런타임 상대해석 dynamic import
  로 tsc 정적해석 우회 → 파일 부재 상태에서도 게이트 초록, RED 는 런타임으로만 드러남).
- easyread MCP: STATE 1/2/3 대표 문구 verdict=pass.
- 저자(W) ≠ 검증자 ≠ 구현자(U). 이 문서 + RED 계약 = HANDOFF→U.
