# P3 재사용 UI 프리미티브 6종 — 설계 (W 저작, U 구현)

> 로드맵: 프론트 재구성 #82 **Phase 3**. 전제: P2 시맨틱 토큰 토대(#…) 안착(main=`fd7328f`).
> 이 문서는 **RED 계약**(`src/components/ui/<Name>.test.tsx` 6종, [HANDOFF→U])의 설계 근거이자
> U 세션의 구현 명세다. 테스트는 행위/ARIA 만 단언하고 **토큰·색·className 은 단언하지 않는다** —
> 토큰/4모드/44px/대비는 eslint jsx-a11y + `tokenFoundation.test.ts` fs-scan + 코드리뷰가 잡는다.

---

## 0. 왜 프리미티브인가 (감사 동기)

| 프리미티브 | 대체 대상(감사 수치) | 없앨 하드코딩 |
|---|---|---|
| **Button** | 손수 만든 primary ~39곳 + 승인/조건부/반려 3종 세트 | `bg-zinc-900 text-white min-h-[44px] rounded-xl disabled:opacity-50` |
| **Card** | 표면 블록 ~84곳 + 오류배너 `bg-red-50…text-red-600` 23회 | `bg-white ring-1 ring-zinc-200`, 반경 스케일 난립 |
| **PageHeader** | sticky 상단바 ~51곳(h1 35 · 뒤로가기 18) | `sticky top-0 bg-background/80 backdrop-blur border-b border-zinc-200` |
| **StatusPill** | rounded-full 배지 ~22곳 + _STYLE/_LABEL 딕셔너리 17파일 | 인라인 `bg-zinc/emerald/amber/red` 상태색 |
| **MoneyText** | won() 헬퍼 16개 + ko-KR 호출부 17곳 | 반올림 분기(Math.round vs 비반올림) |
| **EmptyState** | '아직 …없어요' 문구 ~57개 / 래퍼 ~14종 | `text-zinc-400` 인라인 · `bg-zinc-50` 래퍼 |

공통 원칙: **터치44px·비색큐·leading-relaxed·WCAG AA 4.5:1** 을 프리미티브에 한 번 구워서
화면이 팔레트·상태를 재하드코딩하지 못하게 한다. 색 값 교체는 `html.dark-mode/.high-contrast/.yellow-bg`
가 토큰만 바꿔 처리 — 컴포넌트 안에서 모드 분기 금지.

---

## 1. Button

**API**
```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'positive' | 'warning'
type ButtonSize = 'sm' | 'md'
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant   // 기본 'primary'
  size?: ButtonSize         // 기본 'md'
  loading?: boolean         // 기본 false
  iconOnly?: boolean        // 기본 false — aria-label 로 접근성 이름 필수
  children?: React.ReactNode
}
// next/link 형태 액션은 동일 variant/size 계약을 공유하는 형제 LinkButton(또는 href/asChild)로.
```
**불변식(테스트가 잠금)** — 실제 `<button>` · 기본 `type='button'` · disabled 시 disabled 속성+onClick 무시 ·
loading 시 `aria-busy='true'`+비대화+**보이는 글자 라벨 유지**(색/투명도만으로 상태표시 금지) ·
활성 클릭 onClick 1회 · iconOnly 도 비어있지 않은 접근성 이름.

**a11y** — 접근성 이름 필수(글자 or iconOnly aria-label) · 최소 44×44(리뷰) ·
focus-visible 3px 전역 상속(리뷰) · loading = 스피너+글자(색/투명도 단독 금지).

**토큰 바인딩(리뷰 검증, 테스트 아님)**
```
primary:   bg-primary text-primary-foreground hover:bg-primary-hover
secondary: bg-card ring-1 ring-border text-foreground hover:bg-muted
ghost:     bg-transparent text-foreground hover:bg-muted
danger:    bg-danger text-primary-foreground  (or bg-danger-bg text-danger-fg ring-danger-fg/20)
positive:  bg-positive text-primary-foreground
warning:   bg-warning text-primary-foreground
```
raw 팔레트 금지(bg-zinc-900/800·bg-emerald-600·bg-amber-500·text-white 대체).

**Easy Read** — 라벨은 쉬운 말 동사('저장하기'·'제출하기'·'승인'·'반려'). 파괴적 의도는 색이 아니라
라벨/아이콘으로 구분.

**대체 화면** — budgets/[id](계획 보러 가기·지출 적기·정산 보기·계획 고치기) ·
PlanDetailClient(저장/제출·승인/조건부/반려·통지) · ParticipantDetailClient(기록추가·정산등록·이의 3종) ·
OrgLedgerClient(필터칩·보기).

---

## 2. Card

**API**
```ts
type CardVariant = 'default'|'muted'|'hero'|'success'|'info'|'warning'|'danger'|'neutral'
interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'section'|'article'|'div'   // 기본 'section'
  variant?: CardVariant            // 기본 'default'
  title?: React.ReactNode          // 있으면 heading 슬롯
  headingLevel?: 2 | 3             // title 있을 때 기본 2
  children: React.ReactNode
}
```
**불변식** — children 렌더 · title → `getByRole('heading',{name,level})` · title 없으면 heading 미주입 ·
기본 `<section>` 렌더 · danger 문제는 자식 텍스트로 전달(비색큐).

**a11y/토큰(리뷰)**
```
default: bg-card ring-1 ring-border
muted:   bg-muted ring-1 ring-border          (none-state·중첩 inset)
hero:    bg-hero text-hero-foreground         (보조 text-hero-foreground/70)
status:  bg-{intent}-bg text-{intent}-fg ring-1 ring-{intent}-fg/20   (success|info|warning|danger|neutral)
raw→토큰: bg-white→bg-card · bg-zinc-50/100→bg-muted · bg-zinc-900→bg-hero · ring-zinc-200→ring-border
오류배너 bg-red-50/text-red-600 → variant='danger'
```
⚠️ `.participant-view` 레거시 `!important` 가 rounded-container bg/border 를 강제(HC #fff+2px#000,
dark #1a2540/#2d3f5c) — Card 토큰 값이 이와 어긋나면 흰-배경-흰-글자/이중 테두리. 리뷰에서 대조.

**대체 화면** — 6개 census 전부. hero 반전(당사자 홈 bg-zinc-900→hero), amber 계획밖→warning,
오류배너→danger, zinc-50 입력카드→muted.

---

## 3. PageHeader

**API**
```ts
interface PageHeaderProps {
  title: string
  backHref?: string          // 있으면 '뒤로 가기' 링크
  action?: React.ReactNode   // 우측 슬롯(⚙ 더보기 등)
}
```
**불변식** — `<header>` banner 렌더 · **`id='main-content'` 미소유**(skip-link 는 헤더를 건너뛰어
각 화면 `<main id='main-content' tabIndex={-1}>` 로 점프) · title=단일 level-1 heading ·
backHref → `getByRole('link',{name:'뒤로 가기'})` href===backHref · 없으면 링크 없음 · action 슬롯 유무.

**a11y** — 뒤로 컨트롤 44×44 + aria-label '뒤로 가기' · title=페이지 h1 · sticky 는 불투명 토큰 배경+z-index(리뷰).

**토큰** — `bg-card`(or bg-background) `border-b border-border`(bg-white/80 대체) · title text-foreground.

**서브패턴(범위 밖, 후속)** — 본문 캡션 2티어(A `text-xs font-black uppercase tracking-widest`×24,
B `h2 text-sm font-bold text-zinc-500`×20)는 별도 SectionLabel/CardHeader 필요. 이 6종엔 미포함.

**대체 화면** — budgets/[id](back+‘{name}님의 예산’ h1, 빈/로드 양 분기) · 당사자 홈(h1+⚙ action, back 없음) ·
supporter/participants('당사자' h1, back 없음).

---

## 4. StatusPill  ← 비색큐 하중 프리미티브

**API**
```ts
type Intent = 'success'|'info'|'warning'|'danger'|'neutral'
interface StatusPillProps { label: string; intent: Intent; icon?: React.ReactNode }
```
**불변식** — **어떤 intent 든 항상 label 텍스트 렌더**(getByText 5종 모두 해석 = S5 비색큐를 행위로) ·
intent 를 가로질러도 label 불변 · 장식 icon 은 aria-hidden, 의미는 label 에서.

**왜 하중** — 고대비 모드가 모든 status bg→#fff, fg→#000 으로 blank → 색이 사라진다. **글자 라벨만이
유일하게 살아남는 단서** → label 필수.

**토큰** — `bg-{intent}-bg text-{intent}-fg ring-1 ring-{intent}-fg/20 rounded-full px-2.5 py-1 text-xs font-bold`.
`settlementStatus.ts` 의 bg-zinc/emerald/amber/red 딕셔너리 흡수.

> **§3-3 매핑 확정(W, 2026-09-04)** — 로드맵 채택. 정산(settlement_status): pending→**warning**(대기=액션필요) ·
> accepted→**success** · rejected→**danger** · recovered→**info**(완료된 정보성) · 미지→**neutral**.
> 일반 intent 의미: success=완료·승인 / danger=반려·오류 / warning=액션필요·주의·미결 / info=정보성 진행·결과 / neutral=상태없음·기본.
> 이의신청 결과: upheld→success · partially_upheld→info · dismissed→**neutral**(정당한 확정결과, 오류/파괴 아님).
> 근거: warning=액션필요·info=정보성완료 로 색 의미 분리 → easy-read/a11y 이득(라벨이 비색큐로 의미 전달, 색은 보조).
> 소비처 치환(SETTLEMENT_STYLE→intent)은 Stage B-2(거래장부 계열). RED 계약은 색을 잠그지 않고 label 만 잠근다.

**Easy Read 라벨(당사자 대면 softened)** — ok '쓰는 중이에요' · unused '아직 안 썼어요' ·
over '조금 넘게 썼어요' · unplanned '계획에 없이 썼어요' · none '아직 없어요'.
정산: '정산 완료'/'정산 대기'/'반려'/'환수'. **미지 상태는 원문 라벨 보존(누락 금지)**.

**대체 화면** — 당사자 홈 PARTICIPANT_STATUS 5종 · settlementStatus 소비처(OrgLedger 정산칩×2·
[participantId]/transactions) · budgets/[id] STATUS_STYLE 5종+copay+서비스 배지 ·
PlanDetailClient STATUS_LABEL 7종 · ParticipantDetailClient copayStatus+APPEAL_OUTCOME.

---

## 5. MoneyText

**API**
```ts
type MoneyEmphasis = 'hero'|'body'|'muted'
type MoneySign = 'expense'|'income'|'none'
interface MoneyTextProps { value: number; emphasis?: MoneyEmphasis; sign?: MoneySign; onHero?: boolean }
// 기본 emphasis='body' · sign='none' · onHero=false
```
**불변식** — ko-KR 그룹화 정수 + **'원' 접미사** → `getByText('3,000원')` · **정규 반올림 Math.round**
(1499.6→'1,500원', 비반올림 호출부 봉인) · sign='expense' → **색이 아닌 글자 단서**(선행 '−' 또는
'지출' 단어)로 지출 표시(고대비 대비).

> 구현 지침: 포맷은 공유 `src/utils/budget-visuals.formatCurrency` 에 위임(단일 진실원천, 재구현 금지).
> 단 현행 `formatCurrency` 는 '원' 미부착·비반올림(`Intl.NumberFormat('ko-KR')`)이므로 MoneyText 가
> `Math.round(value)` 후 위임하고 '원' 을 붙인다. (formatCurrency 시그니처 변경은 U 판단 — 다른 호출부
> 영향. 최소침습으로 MoneyText 래핑 권장.)

**토큰** — body text-foreground · expense text-danger · income text-positive · muted text-muted-foreground ·
onHero text-hero-foreground · tabular-nums(리뷰) · 고대비 `.hc-amount`(#000, font-900) 연동(리뷰).

**Easy Read** — 항상 '원'. 지출은 단어/부호('−'/'지출')로도 표시 — 잔액과 지출을 색 없이 구분.

**대체 화면** — 모든 census. budgets/[id] 남은돈 4xl(hero)+영역별+copay · 당사자 홈 remaining 4xl hero ·
PlanDetailClient estimated_cost · ParticipantDetailClient 승인/부담/정산 인정·반려·환수 ·
OrgLedgerClient grandTotal+per-usage(**현재 비반올림 → 정규화**).

---

## 6. EmptyState

**API**
```ts
interface EmptyStateProps {
  emoji?: string                            // 장식, aria-hidden
  title: string
  description?: string
  action?: { label: string; href: string }  // 또는 React 노드
  variant?: 'full' | 'inline'               // 기본 'inline'
}
```
**불변식** — title(+description 있으면) 렌더 · emoji 제공 시 aria-hidden(의미는 글자) ·
action → `getByRole('link'|'button',{name:label})` href===action.href · 없으면 CTA 없음.

**a11y/토큰** — emoji aria-hidden · 쉬운 말·안심 톤 · CTA 는 44px 컨트롤(Button primary 토큰) ·
표면 bg-card/bg-muted ring-1 ring-border · title text-foreground · description **text-muted-foreground(AA 보장 토큰)** ·
raw 대체(text-zinc-400 인라인·bg-zinc-50/100 래퍼).

**Easy Read** — '아직 …없어요' 톤 유지 + 가능하면 항상 다음 행동('계획 보러 가기') 제시(G5).

**대체 화면** — budgets/[id] §5 무배정 full + §4 인라인 · 당사자 홈 no-participant/no-balance/recent ·
supporter/participants 인라인 · PlanDetailClient '아직 작성…'×3 · ParticipantDetailClient '아직 요청이 없어요'.

---

## 7. 구현 순서 권장 (U — 고표면 우선)

1. **MoneyText** — 위험 낮고 census 전면 사용, 반올림 분열 즉시 봉합. formatCurrency 래핑만.
2. **StatusPill** — 비색큐 하중·딕셔너리 17파일 흡수. **단, intent 색 매핑은 W §3-3 확정 후** 잠금.
3. **Card** — 표면 84곳 최대 절감. `.participant-view` !important 대조 필수.
4. **Button** — 39곳+결정 3종. loading 비대화·기본 type 주의.
5. **PageHeader** — 51곳. skip-link 타깃 불가침(id='main-content' 미소유) 확인.
6. **EmptyState** — 57문구, Button 토큰 재사용(1~4 이후).

각 구현 후 해당 `<Name>.test.tsx` 초록 확인 → tokenFoundation `TOKENIZED_FILES` 에 프리미티브+소비
화면 추가(별도 W 레인 편집) → 소비 화면 raw 팔레트 스캔 초록.

## 8. RED 상태 (이 커밋)

`npx vitest run` → **6 failed(전부 '미존재 모듈' import 해석 실패) · 23 passed · 181 tests passed**.
6종 신규 스위트만 RED, 기존 테스트 전원 초록. `tsconfig include=**/*.tsx`(테스트 미제외)라 미존재 import 는
tsc TS2307·vitest·next build 세 곳 모두 붉게 만든다 → quality-check 전체 RED = U 구현까지 정직하게 유지.
