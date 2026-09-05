# P7 웨이브2 — 포커스·인터랙션 복구 설계문 (W)

> **역할 분리**: 이 문서와 RED 계약(`src/test/p7FocusWave2.test.ts`,
> `src/components/ui/Modal.test.tsx` 확장)은 **W(설계·검증)** 저작이다.
> `src/**` 구현(16개 화면 · `globals.css` · `Modal.tsx`)은 **U(app-6c)** 레인이다.
> W 는 계약과 이 설계문만 만든다 — 구현 파일은 열지 않는다.
>
> **RED 근거(HEAD 990b19a, 2026-09-05 실측)**: `focus:outline-none` 46곳 / `focus-visible:ring` 0 /
> `focus:ring-muted-foreground` 15 / `focus:ring-foreground` 24 / `focus:ring-primary` 4 /
> `globals.css` slide-in 키프레임 부재 / 두 드로어 dead class 존재 / Modal 배경 형제에 inert·aria-hidden 부재.

---

## 0. 배경 — 왜 "회귀"인가

P6 색 토큰화 sweep 이후 접근성 **근간(포커스 가시성 · 배경 억제 · 드로어 모션)** 이 조용히 깨져 있었다.
전역 `:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 3px }`(globals.css:368-370)는
살아 있지만, 화면 곳곳의 폼 컨트롤이 `focus:outline-none` 으로 이 전역 링을 **무력화**해 키보드 포커스
위치가 사라진다(KWCAG 2.4.7 포커스 가시성 위반). 드로어 애니는 `tailwindcss-animate` 플러그인이 미설치라
`animate-in slide-in-from-*` 이 **죽은 클래스**다. 모달은 배경을 SR/키보드로부터 차단하지 않는다.

네 항목(D1·D2·C1·D9)은 fs-scan + jsdom 으로 "클래스/속성 존재"까지 자동 잠그고, **픽셀·모션·실제 AT 억제**는
이 문서의 수동 QA 체크리스트(§6)가 덮는다.

---

## 1. D1 / D9 — focus 가시성 복원 (design-doc-visual)

### 원칙
raw 폼 컨트롤(input/textarea/select/button)의 **정본 패턴 = `focus:outline-none` + 색상전용
`focus:ring-{foreground,muted-foreground}` 동반을 통째로 제거**하고, 요소가 전역
`:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 3px }` 를 **상속**하게 둔다.
쉼(resting) 상태의 `ring-1 ring-border` 는 유지한다. 이것이 최소 diff 이며, 가장 강하고 일관된 링을 준다.

```
- className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm focus:ring-muted-foreground focus:outline-none"
+ className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm"
```

요소 내부 커스텀 링이 **정말로** 필요한 곳(PreviewBanner 색 배너, 그리고 이미 좋은 패턴인
ProfileEditClient/OnboardingClient)만 `focus-visible:ring-2` + 컨텍스트 토큰을 쓴다 — **bare `focus:ring-*`
금지**.

### 규칙이 강제하는 것 (계약 D1+D9, fs-scan)
- 대상 16 파일의 모든 className 문자열에서 **BARE `focus:outline-none` = 0**.
  BARE = `/focus:outline-none/` 를 포함하되 같은 문자열에 폭 링 `/focus-visible:ring-(1|2|4)/` 미동반.
- 발생당 GREEN = (a) `focus:outline-none` 제거 → 전역 링 상속, 또는 (b) 같은 문자열에 `focus-visible:ring-N`.
- **순수 `:focus` 색상전용 동반은 불충족** — 폭 링은 반드시 `focus-visible:` 변형이어야 한다.
  (이 한 규칙이 D1 가시성과 D2 색을 동시에 못 박는다.)
- 집계 가드: 16파일 합계 BARE === 0 (RED 오늘 46).
- **D9**: `login/page.tsx` 로고 버튼(현재 동반 링 없는 `focus:outline-none`) 포함 — Tab 시 보이는 링이
  나타나야 한다. 최소 diff = `focus:outline-none` 만 제거(전역 3px primary 링 상속).
- **ReceiptClient 5곳**(현재 no-ring `focus:outline-none`) 각각 상속 or `focus-visible:ring-N` 로 준수.
- 회귀 가드(D1 파일 밖 포함 src 전체): bare `focus:ring-1|2|4` === 0 — 새 폭 링은 언제나
  `focus-visible:` 변형으로만.

### fs-scan 이 볼 수 없는 것 → §6 수동 QA
실제 렌더된 3px 링 픽셀·`outline-offset`·`focus-visible` 전용(마우스 클릭 시 링 미표시) 동작.

### 대상 16 파일 (U 구현 레인)
`login/page.tsx` · `my-plan/MyPlanClient.tsx` · `receipt/ReceiptClient.tsx` ·
`admin/invitations/InvitationsClient.tsx` · `admin/participants/[id]/ParticipantDetailClient.tsx` ·
`admin/participants/new/page.tsx` · `supporter/[participantId]/assessment/AssessmentClient.tsx` ·
`supporter/[participantId]/transactions/new/NewTransactionClient.tsx` ·
`supporter/applications/[id]/ApplicationDetailClient.tsx` · `supporter/applications/new/page.tsx` ·
`supporter/evaluations/[participantId]/EvaluationClient.tsx` · `supporter/plans/[id]/PlanDetailClient.tsx` ·
`supporter/plans/new/NewPlanClient.tsx` · `supporter/review/ReviewQueueClient.tsx` ·
`components/admin/PreviewBanner.tsx` · `components/map/PlaceSearch.tsx`

---

## 2. D2 — focus 링 색 토큰 단일화 (primary 수렴)

유일한 정본 focus 색 = `--color-primary`(이미 전역 `:focus-visible` outline 색). §1 의 제거가 요소 내부
링 46곳을 전역 primary 링 하나로 자동 붕괴시킨다. `bg-muted`/`bg-card` 위 저대비였던
`focus:ring-muted-foreground` 15곳은 전부 사라져야 한다.

### 규칙 (계약 D2, fs-scan · src 전체)
- `focus:ring-muted-foreground` === 0 (RED 15).
- bare `focus:ring-foreground` === 0 (RED 24).
- **PreviewBanner** 컨텍스트 링(`focus:ring-info-solid-foreground`·`focus:ring-warning-foreground`)은
  bare `focus:` 변형이 아니어야 한다 → `focus-visible:ring-2` + 컨텍스트 토큰으로.
  ```
  - className={`... cursor-pointer focus:outline-none focus:ring-2 ${... ? '... focus:ring-info-solid-foreground' : '... focus:ring-warning-foreground'}`}
  + className={`... cursor-pointer focus-visible:ring-2 ${... ? '... focus-visible:ring-info-solid-foreground' : '... focus-visible:ring-warning-foreground'}`}
  ```
- `globals.css` `:focus-visible`(outline 3px var(--color-primary))는 **유일 색 근원으로 불변** 유지.

### 참고 — 범위 밖 good-pattern 사이트
`ProfileEditClient`·`OnboardingClient` 의 `focus:ring-2 focus:ring-primary outline-none`(4곳)은
16파일 밖이라 이번 웨이브 **하드 계약 대상은 아니다**. 다만 정합상 `focus-visible:ring-2
focus-visible:ring-primary` 로 옮기는 것이 권장 방향이다(선택). 하드 계약은 `focus:ring-foreground`·
`focus:ring-muted-foreground`·PreviewBanner 만 잠근다.

---

## 3. C1 — 드로어 slide-in @keyframes (design-doc-visual, globals.css)

코드베이스는 `tailwindcss-animate` 미설치이고 `globals.css` 는 `@import "tailwindcss"` 만이라
`animate-in slide-in-from-*` 은 keyframe 이 없는 **죽은 클래스**다. 플러그인을 새로 설치하지 말고,
기존 손수 만든 `@layer utilities`(bounce-slow/float/fadeInUp …) 관례를 따라 키프레임을 추가한다.

### globals.css 에 추가(`@layer utilities` 블록 안, 기존 easing family 옆)
```css
@keyframes slide-in-right { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes slide-in-left  { from { transform: translateX(-100%) } to { transform: translateX(0) } }
.animate-slide-in-right { animation: slide-in-right .2s cubic-bezier(0.34, 1.56, 0.64, 1) }
.animate-slide-in-left  { animation: slide-in-left  .2s cubic-bezier(0.34, 1.56, 0.64, 1) }
```

### className 교체(2곳)
- `NavDropdown.tsx:76` — 우측 내비 드로어:
  `animate-in slide-in-from-right duration-200` → `animate-slide-in-right`
- `SupporterLayoutClient.tsx:88` — 좌측 관리자 드로어:
  `animate-in slide-in-from-left duration-200` → `animate-slide-in-left`

### 설계 근거
- **200ms 보존**(현재 의도). easing `cubic-bezier(0.34,1.56,0.64,1)` = 기존 fadeInUp/celebrate 와 동일 family.
- **enter-only 로 충분**: 두 드로어 모두 열림에 mount / 닫힘에 unmount 라 exit 애니·`animation-fill-mode`
  불필요(쉼 상태 `translateX(0)` 이 자연값).
- **prefers-reduced-motion 은 이미 전역 처리됨**(globals.css:391 `*,*::before,*::after {
  animation-duration:0.01ms !important }`) → 새 유틸이 자동으로 즉시-표시 상속. per-utility 가드 불필요.

### 규칙 (계약 C1, fs-scan)
- globals.css 가 `@keyframes slide-in-right` / `slide-in-left` 정의.
- globals.css 가 `.animate-slide-in-right` / `.animate-slide-in-left` 유틸 정의.
- NavDropdown·SupporterLayoutClient 에 `animate-in`·`slide-in-from-` 부재 + 각 새 유틸 참조.

### fs-scan 이 볼 수 없는 것 → §6 수동 QA
실제 슬라이드 모션(시간축 픽셀)·reduce-motion 즉시 표시.

---

## 4. D11 — Modal 배경 형제 inert/aria-hidden (jsdom 계약)

`Modal` 은 `createPortal(document.body)` 로 그려지므로 "배경" = 포털 루트를 뺀 **body 형제**들이다.
현재 세 effect(포커스 이동·scroll-lock·Esc/Tab 트랩)는 dialog 내부와 `document.body.style` 만 만지고
배경 형제에는 아무 속성도 걸지 않아 SR/키보드가 배경에 도달한다.

### 계약(느슨: inert OR aria-hidden — U 최소diff 과잉제약 방지; `Modal.test.tsx` 확장)
- 열림: 포털 루트를 뺀 body 형제 각각이 `inert` 또는 `aria-hidden="true"`.
- 포털 루트(dialog subtree)는 **제외** — 스스로 숨기지 않는다.
- 닫힘(Esc): 배경 형제의 inert/aria-hidden 이 **모두 해제** + 포커스가 트리거로 복원.
- 회귀 가드: 기존 focus-restore·Tab/Shift+Tab 트랩·Esc·scroll-lock 계약 무손상.

### U 구현 주의 — 정리 순서(load-bearing)
- `inert` 로 구현하면 **닫힘 정리 effect 가 focus-restore 보다 먼저 형제 inert 를 제거**해야 한다.
  안 그러면 트리거가 inert 안에 있어 재포커스가 안 된다(`Modal.tsx:49-51` 의 restore cleanup 순서).
- 포털 루트에 **data-attribute** 를 달고 그것만 제외하라("self 아닌 전부 숨김"이 아니라). 그래야 두 번째
  스택 모달이 잘못 숨겨지지 않는다.
- **Element 형제만** 대상(text/script/comment 노드 skip) — `Array.from(document.body.children)` 사용.
- jsdom 은 inert 의 실제 포커스 차단을 에뮬레이트하지 않으므로 계약은 속성 **존재**만 단언한다. 실제
  AT/SR 억제는 §6 수동 QA.
- `tsc --noEmit` 게이트는 D1/D2/C1 엔 형식(className·CSS 문자열만) — 실질 부담은 **D11(Modal effect
  편집)** 뿐이다.

---

## 5. 게이트

- `npx vitest run` — 웨이브2 RED 4계약(D1+D9 fs / D2 fs / C1 fs / D11 jsdom) 실패 확인 + **기존 스위트
  무손상**(특히 Modal 의 기존 8 계약).
- `tsc --noEmit` — 필수 게이트. D1/D2/C1 은 formality, D11(Modal.tsx effect)만 실질.
- U 는 이 문서·계약 대로 16파일 + globals.css + Modal.tsx 구현 → 초록.

---

## 6. 수동 픽셀·모션 QA 체크리스트 (design-doc, 자동화 불가 수용 계층)

fs-scan(클래스 존재)·jsdom(속성 존재)이 볼 수 없는 층 — 렌더된 링 픽셀·슬라이드 모션·실제 AT 배경 억제.

- [ ] **D1 링 픽셀**: 16파일의 모든 input/textarea/select/button 을 키보드 Tab 순회 — 포커스된 컨트롤에
      3px `var(--color-primary)` 링(또는 명시 `focus-visible:ring-2`)이 보인다.
- [ ] **D1 focus-visible 전용**: 같은 컨트롤을 **마우스 클릭** — 링이 그려지지 **않는다**(focus-visible-only).
- [ ] **D9 로고**: `/login` 에서 로고까지 Tab — 가시 포커스 인디케이터가 나타난다(현재 없음).
- [ ] **C1 우측 드로어**: 당사자 내비 드로어 열기 — 오른쪽 화면 가장자리에서 ~200ms 슬라이드 인.
- [ ] **C1 좌측 드로어**: 관리자 사이드 드로어 열기 — 왼쪽 가장자리에서 ~200ms 슬라이드 인.
- [ ] **C1 reduce-motion**: OS 동작 줄이기 켠 상태에서 두 드로어 모두 즉시 표시(슬라이드 없음), 포커스 링은
      여전히 보인다.
- [ ] **D11 배경 억제**: 모달 열림 중 스크린리더/키보드로 배경 콘텐츠에 도달 **불가**. 닫으면 다시 도달
      가능 + 트리거가 포커스를 되찾는다.
