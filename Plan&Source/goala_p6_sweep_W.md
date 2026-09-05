# P6 대비 완성 sweep — 잔여 raw 팔레트 → 시맨틱 토큰 (W 설계)

> 로드맵 #82 P6 의 마지막 조각. Phase A(대비 7파일)·다크토큰(AdminSidebar)이 패턴을 확립했고,
> 이 sweep 이 **잔여 화면 전부**를 시맨틱 토큰으로 전환해 앱 전역 WCAG AA 를 완성한다.
> 새 토큰·구조·행위 변경 **없음** — 이미 있는 시맨틱 토큰으로 raw 팔레트만 치환하는 **기계적** 작업.

## 규모 (실측 · tokenFoundation raw 정규식)
- **87 파일 / 1327 raw hits** (AdminSidebar 제외 — 다크토큰서 완료).
- 4 배치, **순차** 진행(각 배치가 `src/test/tokenFoundation.test.ts` `TOKENIZED_FILES` 를 확장 → 공유파일이라 병렬 불가). 배치별 계약(W)→토큰화(U 병렬워커)→검증→머지.

## RED 메커니즘 (배치마다 동일)
W 가 배치 파일들을 `TOKENIZED_FILES` 에 추가 → 각 파일이 raw 팔레트(bg-zinc·text-zinc·ring-amber…)를 보유하므로 스캔 실패 = RED. U 가 시맨틱 토큰으로 치환 → raw-0 → green. **tokenFoundation 스캔 로직·기존 항목·다른 배치 무변경**.

## 확립 매핑표 (정본 — P2 §3-4 · Phase A §4 재사용)
| raw 팔레트 | 시맨틱 토큰 | 용도 |
|---|---|---|
| `bg-white` | `bg-card` (표면 카드) / `bg-background` (페이지 바탕) | 문맥에 따라 |
| `bg-zinc-50` `bg-zinc-100` | `bg-muted` | 옅은 표면·스켈레톤 블록 |
| `bg-zinc-200` `bg-zinc-300` | `bg-muted` (진한 스켈레톤도 muted 통일) | 스켈레톤·구분면 |
| `text-zinc-900` `text-zinc-800` | `text-foreground` | 본문 강조 |
| `text-zinc-600` `text-zinc-700` | `text-muted-foreground` | 본문 보조 |
| `text-zinc-400` `text-zinc-500` | `text-muted-foreground` | 캡션·placeholder |
| `border-zinc-200` `ring-zinc-200` | `border-border` `ring-border` | 경계·링 |
| `bg-emerald-50` / `text-emerald-700` | `bg-success-bg` / `text-success-fg` | 성공 상태 |
| `bg-amber-50/100` / `text-amber-700` / `ring-amber-200` | `bg-warning-bg` / `text-warning-fg` / `ring-warning-*` | 경고 상태 |
| `bg-red-50` / `text-red-600` | `bg-danger-bg` / `text-danger-fg` | 오류 상태 |
| `bg-blue/indigo/sky-50` / `text-…-700` | `bg-info-bg` / `text-info-fg` | 정보 상태 |
| `bg-zinc-900` (히어로) | `bg-hero` / `text-hero-foreground` | 어두운 히어로 표면 |
- **비색큐 보존**: 색만 바꾸고 라벨·아이콘·구조는 그대로. 상태를 색으로만 전달하던 곳 없음(기존 확인).
- **AA**: 위 시맨틱 토큰은 P2·#89 에서 4모드(라이트/다크/고대비/노랑) AA≥4.5:1 검증 완료 — 치환만 하면 대비 자동 충족.
- **애매하면**: 색을 '의미'로 해석(성공/경고/오류/정보/중립) 후 해당 시맨틱군. 순수 회색 표면·텍스트는 muted/foreground/card/border.

## 배치 계획 (위험·레버리지 순)
### Batch 1 — 로딩 스켈레톤 15 (~203 hits) · **이번 계약**
`app/loading.tsx` · `(participant)/{,calendar,evaluations,gallery,map,more,plan,receipt,settings/profile}/loading.tsx` · `(supporter)/admin/{,participants,participants/[id]}/loading.tsx` · `(supporter)/supporter/{review,transactions/[id]}/loading.tsx`.
- 순수 표현(bg-zinc 블록 + animate-pulse), 행위·데이터·문구 0 → **최저위험, 최우선**. animate-pulse·레이아웃 클래스 유지.
- ★겹침: `(participant)/loading.tsx`·`app/loading.tsx` 는 Phase C 가 `<main id=main-content>` 추가함(2887da0). 색 토큰화는 그 위에 rebase — landmark 라인과 무관(다른 클래스).

### Batch 2 — 공용 컴포넌트 17 (재사용 레버리지 최대)
`components/{admin/ParticipantHomePreviewClient(56 hits),admin/PreviewBanner,help/*,home/WaterCupPlanPreview,layout/{NavDropdown,NavigationProgress},map/{KakaoMap,PlaceSearch},ui/{ComingSoon,FaqButton,FormField,ImageLightbox,Modal,SelfCheckFeedback}}`.
- ★★겹침 경고: `ui/FormField·Modal·ImageLightbox·SelfCheckFeedback·ComingSoon`(Phase B) · `layout/NavDropdown·NavigationProgress·FaqButton`(Phase C) — **색 토큰만** sweep, ARIA/구조는 각 phase 계약 소유(절대 안 건드림). 이 배치는 Phase B/C 머지 후라 안전.

### Batch 3 — 당사자 화면 17 (easy-read 우선)
`my-plan/MyPlanClient(39)·map/MapTabsClient(26)·settings/profile/ProfileEditClient(23)·evaluations/page(23)·calendar/CalendarClient(21)·guide/page·plan/page·gallery/page …`.
- ★일부(evaluations/page·my-plan/MyPlanClient·gallery/page)는 Phase C list 화면 = 색 토큰화만 추가(구조 이미 완료).

### Batch 4 — 실무자/관리자 화면 35 (분할 권장)
4a: transactions/applications/plans/network/review · 4b: assessment/evaluation/settings. 대용량: `EvaluationClient(55)·assessment(47)·ApplicationDetailClient(51)·NewTransactionClient(41)`.

## 자동 sweep 제외 (수동 검토 3)
`(auth)/layout.tsx` · `app/layout.tsx` · `utils/budget-visuals.ts`(JSX 아님 — class 문자열 반환, 토큰 매핑 수동 판단 필요). 배치에서 빼고 별도.

## 게이트 (배치마다)
- U: 해당 배치 raw-0(tokenFoundation green) · 시각 무회귀(레이아웃·애니 유지) · **tsc --noEmit** · build · lint.
- W: 색→시맨틱 매핑 정합(의미 보존·오배치 0) · 비색큐 유지 · 4모드 AA(토큰 재사용이라 자동) · 정직 green(구조/문구 무변경).
