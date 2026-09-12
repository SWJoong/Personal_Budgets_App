# 당사자 시각 잔액 위젯 복원 + 슈퍼관리자 역할 전환기 — 설계권위 (W)

> 사용자 요청(2026-09-12): ① 당사자 첫 화면 F12 분석 중 발견 — **시각 잔액 위젯(쉬운 정보)이 안 나옴**
> → 복원(5스타일 전부). ② cheese0318@gmail.com 로그인 시 **우측 상단 관리자 표시 + 실무자·당사자 화면 전환**.
> 앱 전용(DB/Manual-Ops 없음). 목표: 3역할 접근성 + 당사자 인지 접근성.

## 슬라이스 1 — 당사자 시각 잔액 위젯 복원 (인지 접근성 F0)

### 배경(회귀)
`화면 설정`에 `balance_widget_style`(pie·water·cash·emoji·text, 기본 pie)·`balance_emoji` 가 있고
`balance_widget` 은 필수 블록인데, 홈 리빌드(P2/서울형) 때 **렌더가 누락**됨 — 홈은 텍스트 숫자만.
`getBudgetVisualInfo`(budget-visuals)는 고아 + raw 클래스(구 팔레트). 설정 피커 UI 도 없음.

### 1-1. 신규 `src/components/home/BalanceWidget.tsx` (프리젠테이셔널)
- props: `{ remaining, total, spent, style: BalanceWidgetStyle, emoji }`.
- **정보는 텍스트로도 반드시**(그래픽 모양·색만으로 전달 금지 — 지적·시각 공통):
  라벨 "지금 쓸 수 있는 돈" + 금액(`MoneyText`) + **남은 비율 %**(예 25%) 를 항상 노출.
- 위젯 전체를 `role="img"` + `aria-label`(라벨+금액+비율 한 문장)로 요약. 장식 그래픽은 `aria-hidden`.
- 스타일별 표현:
  - `pie`: SVG 도넛(남은 비율). `water`: 컵/용기 채움(비율). `cash`: 지폐/더미 비율. `emoji`: 고른 이모지.
    `text`: 큰 숫자(현행 히어로와 동등).
- 색은 **시맨틱 토큰만**(비율대 상태 → success/info/warning/danger bg·fg). raw `bg-green-50` 금지.
  상태·비율·아이콘은 `getBudgetVisualInfo({percentage,status,icon})` **재사용 가능**(bgClass/themeColor 는 무시,
  토큰으로 매핑). getBudgetVisualInfo 자체·그 골든(budget-visuals.test)은 **건드리지 않는다**.
- 방어: total 0·remaining 0 나눗셈 안전(0%).
- 계약: `src/components/home/BalanceWidget.test.tsx`.

### 1-2. 홈 배선 `src/app/(participant)/page.tsx`
히어로 텍스트 블록을 `<BalanceWidget remaining={balance.remaining} total={balance.allocated_amount}
spent={balance.spent} style={prefs.balance_widget_style} emoji={prefs.balance_emoji} />` 로 교체.
(prefs 는 이미 `getUIPreferences` 로 조회 중 — style/emoji 만 추가로 읽어 전달.) 히어로 표면(bg-hero)은 유지 가능.

### 1-3. 설정 피커 `src/app/(participant)/settings/display/DisplaySettingsClient.tsx`
"잔액 위젯 모양" 선택 추가 — **라디오 5개**(파이/물컵/현금/이모지/글자) role=radio, 현재값 checked,
선택 시 `saveUIPreferences(participantId, { enabled_blocks(현행), balance_widget_style: 선택, balance_emoji })`.
(이모지 선택은 선택적 — 몇 개 프리셋. 없으면 기본 유지.) 계약: `DisplaySettingsClient.balancestyle.test.tsx`.

## 슬라이스 2 — 슈퍼관리자 역할 화면 전환기

### 배경·안전
슈퍼관리자(`isSuperAdminEmail`, BUILTIN=cheese0318@gmail.com)는 이미 admin 역할이라 /admin·/supporter
(requireStaff 통과)·당사자(view-as) 화면에 도달 가능. 이 전환기는 **권한 확장이 아니라 표시 대상 전환**
(기존 view-as 모델과 동일). 기존 `actions/viewAs.ts`(enter/exitParticipantView, admin 게이트) 재사용.

### 2-1. 신규 액션 `src/app/actions/viewAs.ts` 에 `superAdminSwitch(target)`
`export async function superAdminSwitch(target: 'admin'|'supporter'|'participant')`:
- `assertAdmin()` (슈퍼관리자는 admin 역할). 
- `'admin'`: view-as 쿠키 삭제 → redirect `/admin`.
- `'supporter'`: view-as 쿠키 삭제 → redirect `/supporter`.
- `'participant'`: 첫(또는 데모) 참여자 1명 조회 → `enterParticipantView` 와 동일하게 쿠키 set → redirect `/`.
  (참여자 0명이면 `/admin/participants` 로.)

### 2-2. 신규 `src/components/layout/SuperAdminSwitcher.tsx` ('use client')
- props `{ isSuperAdmin: boolean, current: 'admin'|'supporter'|'participant' }`. `!isSuperAdmin` → `return null`.
- **우측 상단 고정**(fixed top-right, z 높게, print:hidden). "관리자" 배지 + 3 버튼(관리자/실무자/당사자).
- 현재 역할 버튼 `aria-pressed=true`. 클릭 → `superAdminSwitch(target)`(useTransition). 44px·focus-visible·토큰.
- 접근성: group `aria-label="역할 화면 전환"`. 계약: `SuperAdminSwitcher.test.tsx`.

### 2-3. 마운트 (서버 레이아웃이 슈퍼관리자 판정 후 내려줌)
`src/app/(participant)/layout.tsx` 와 `src/app/(supporter)/layout.tsx`(=/supporter·/admin 포함) 에서
로그인 사용자 이메일로 `isSuperAdminEmail(email, process.env.SUPER_ADMIN_EMAIL)` 판정 →
`<SuperAdminSwitcher isSuperAdmin current={...} />` 렌더. current 는 경로/역할로 판정
(participant layout=participant 또는 view-as, supporter layout=경로가 /admin 이면 admin 아니면 supporter).
레이아웃이 클라이언트면 서버 판정값을 prop 으로 받도록 소폭 조정(또는 서버 래퍼).

## 게이트
각 슬라이스 tsc0·lint0·vitest(신규 계약+회귀0)·build0 + 라이브(잔액 위젯 5스타일 육안·전환기 3역할 이동).
앱 전용·DB/Manual-Ops 없음.
