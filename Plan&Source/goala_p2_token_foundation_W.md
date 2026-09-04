# P2 · 디자인 토큰 토대 (W 설계 → U 구현)

> 작성: **W(설계·검증)** · 대상: **U(구현)** · 2026-09-03 · test-first
> 상위: `goala_frontend_rearchitecture_W.md` **Phase 2**. 목적: `zinc-*` 하드코딩 → 시맨틱 토큰,
> 테마를 **토큰 값 교체**로 단일화(`!important` 오버라이드 부채 제거의 토대).
> 레인: 이 스펙·계약(`src/test/tokenFoundation.test.ts`) = **W** · `globals.css`·화면 = **U**.

---

## 1. 문제 (실측)

`src/app/globals.css` `@theme` 에 시맨틱 토큰(`--color-background/foreground/card/muted/border/primary/…`)이
있으나, 화면은 `bg-white`·`text-zinc-600`·`bg-emerald-50` 를 **직접** 쓴다. 그래서 다크/고대비/노랑 모드가
하드코딩 클래스를 되받아치는 **`!important` 오버라이드 ~200줄**(`globals.css:353~648`)이 됐다 —
브리틀·비확장·유지불가. **근본 원인 = 화면이 토큰이 아니라 raw 팔레트를 씀.**

## 2. 목표 (End State)

- 화면은 **시맨틱 토큰만** 사용(raw `zinc-*`·`bg-white`·`bg-*-50` 금지).
- 테마 = **토큰 값만 재정의**(`html.dark-mode { --color-* }`) → `!important` 화면별 오버라이드 소멸.
- 접근성 7모드(폰트3·고대비·노랑·다크·쉬운용어) 유지, `useAccessibility` **API 불변**(구현만 토큰화).

> **전략(strangler)**: 토큰·매핑을 P2 에서 확정하고 **앵커 화면 1개(당사자 홈)** 를 완전 토큰화해 패턴을
> 증명·회귀잠금한다. 나머지 화면은 P3(프리미티브)와 함께 순차 이관. `!important` 블록 **삭제는 전 화면
> 이관 완료 시점**(P3 말) — P2 에선 삭제하지 않는다(미이관 화면이 아직 의존). P2 변경은 **가산적**(토큰 추가)이라 안전.

---

## 3. 토큰 어휘 (P2 확정)

### 3-1. 기존(`@theme`, 유지)
`primary`·`primary-hover`·`primary-foreground` · `positive`·`warning`·`danger` ·
`background`·`foreground`·`card`·`card-foreground`·`muted`·`muted-foreground`·`border`·`input`·`accent`·`accent-foreground`.

### 3-2. 신규 추가 (U가 `@theme` + 각 테마블록에 정의)
| 토큰 | 용도 | Light(제안, 4.5:1 검증) | Dark | 고대비 |
|---|---|---|---|---|
| `--color-hero` / `--color-hero-foreground` | 잔액 히어로(현 `bg-zinc-900 text-white`) | `hsl(222 47% 11%)` / `hsl(210 40% 98%)` | `hsl(222 47% 16%)` / `hsl(210 40% 95%)` | `#000` / `#fff` |
| `--color-success-bg` / `--color-success-fg` | ok·정산완료(emerald) | `hsl(145 60% 94%)` / `hsl(145 63% 28%)` | `hsl(145 40% 18%)` / `hsl(145 55% 72%)` | `#fff` / `#000` |
| `--color-info-bg` / `--color-info-fg` | 미사용·환수(sky) | `hsl(205 85% 94%)` / `hsl(205 75% 33%)` | `hsl(205 45% 20%)` / `hsl(205 70% 74%)` | `#fff` / `#000` |
| `--color-warning-bg` / `--color-warning-fg` | 초과·계획없음·대기(amber) | `hsl(40 90% 92%)` / `hsl(32 80% 30%)` | `hsl(38 45% 20%)` / `hsl(40 80% 72%)` | `#fff` / `#000` |
| `--color-danger-bg` / `--color-danger-fg` | 반려(red) | `hsl(0 80% 95%)` / `hsl(0 65% 40%)` | `hsl(0 40% 22%)` / `hsl(0 75% 78%)` | `#fff` / `#000` |
| `--color-neutral-bg` / `--color-neutral-fg` | 없음·기타(zinc) | `hsl(220 20% 93%)` / `hsl(220 10% 38%)` | `hsl(217 32% 20%)` / `hsl(215 20% 72%)` | `#fff` / `#000` |

> 값은 **제안**. U 구현 후 W 가 대비 4.5:1(S4)·비색큐(S5) 검증. 고대비는 흑백+테두리+**텍스트 라벨(비색큐)**로 상태 구분.
> 노랑 모드: 상태 bg 는 light 값 유지하되 노랑 배경과 대비만 확인(니치 모드).

### 3-3. 상태 의미 매핑 (참여자·정산 → 5 intent)
| 도메인 상태 | intent |
|---|---|
| 참여자 ok / 정산 accepted | success |
| 참여자 unused / 정산 recovered | info |
| 참여자 over·unplanned / 정산 pending | warning |
| 정산 rejected | danger |
| 참여자 none / 정산 other | neutral |

---

## 4. raw → token 매핑 (U 이관 가이드)

| raw (현행) | token (교체) | 비고 |
|---|---|---|
| `bg-white` | `bg-card` | 카드/섹션 표면 |
| `bg-zinc-50` · `bg-zinc-100` | `bg-muted` | 옅은 채움 |
| `bg-zinc-900`(히어로) | `bg-hero` | 잔액 히어로 |
| `text-white`(히어로 위) | `text-hero-foreground` | |
| `text-white`(primary 버튼 위) | `text-primary-foreground` | |
| `text-zinc-900·800·700` | `text-foreground` | 본문 |
| `text-zinc-600·500·400` | `text-muted-foreground` | 보조문구(토큰이 4.5:1 보장) |
| `border-zinc-200`·`border-zinc-100` | `border-border` | |
| `ring-zinc-200` | `ring-border` | |
| `bg-emerald-50 text-emerald-700 ring-emerald-200` | `bg-success-bg text-success-fg ring-success-fg/20` | 상태칩(success) |
| `bg-sky-50 text-sky-700 ring-sky-200` | `bg-info-bg text-info-fg ring-info-fg/20` | info |
| `bg-amber-50 text-amber-700 ring-amber-200` | `bg-warning-bg text-warning-fg ring-warning-fg/20` | warning |
| `bg-zinc-100 text-zinc-500 ring-zinc-200`(none칩) | `bg-neutral-bg text-neutral-fg ring-neutral-fg/20` | neutral |

> 이미 토큰인 `bg-background`·`text-foreground` 는 유지. **판단 필요**: `zinc-900` 이 히어로가 아니라
> 그냥 진한 버튼이면 `bg-primary`(맥락별). U 가 매핑표 기준 + 맥락으로 치환, 애매하면 W 확인.

---

## 5. `globals.css` 변경 (U, 가산적)

1. `@theme` 에 §3-2 신규 토큰 **추가**(light 값).
2. `html.dark-mode`·`html.high-contrast`·`html.yellow-bg` 블록에 §3-2 신규 토큰 **재정의 추가**.
   (기존 토큰 재정의는 이미 있음 — 신규 토큰만 보강.)
3. **기존 `!important` 오버라이드(`:353~648`)는 이번엔 건드리지 않는다** — 미이관 화면이 아직 의존.
   앵커 화면은 raw 클래스가 사라져 그 오버라이드에 **매칭되지 않으므로**(no-op) 토큰만으로 테마가 동작.

## 6. 앵커 화면 이관 (U)

`src/app/(participant)/page.tsx` — §4 매핑표대로 raw → token 전량 치환. 이 파일에서 **금지 raw 클래스 0** →
계약 테스트 green. 잔액 히어로·영역별 상태칩·바로가기·최근사용 전부 토큰화(이 화면이 표면·텍스트·경계·상태칩을
모두 포함해 패턴 예시로 최적).

## 7. W 계약 — `src/test/tokenFoundation.test.ts` (RED)

`aiGateBoundary.test.ts` 형 **fs-스캔 적합성 테스트**. `TOKENIZED_FILES`(P2=앵커 1개)에 **금지 raw 팔레트
클래스가 없음**을 단언. 현재 앵커에 raw 클래스 존재 → **RED**. U 이관 시 green. Phase 진행 시 배열 확장(P3).

- 금지 패턴: `(bg|text|border|ring|from|via|to|divide|outline|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50~950)` + `(bg|text|border|ring)-white`.
- 주석 제거 후 스캔(오탐 방지). 스캐너 살아있음 단언(파일 실제 읽힘) 포함.
- **CI RED 예상**(test-first) — U 가 §5·§6 구현하면 green. main 은 U 이관 후 머지라 계속 green.

## 8. U 핸드오프 체크리스트

1. `globals.css`: §3-2 신규 토큰 추가(`@theme` + dark/high-contrast/yellow 재정의). (§5)
2. `(participant)/page.tsx`: §4 매핑표로 raw → token 전량 치환. (§6)
3. 게이트: `npm test`(계약 green 포함) · `lint` · `build`. **테마 육안 QA**: 앵커 화면을 light/dark/고대비/노랑에서
   확인 — 히어로·상태칩·표면·텍스트가 `!important` 없이 토큰만으로 정상.
4. W 재검증: 대비 4.5:1(S4)·비색큐(S5)·easy-read(문구 변경 시). 이후 P3 에서 프리미티브(StatusPill 등)로 승격 +
   `TOKENIZED_FILES` 확장.

## 9. 검증 (W 게이트)
- 계약 테스트 green(앵커 raw 0).
- 앵커 화면 4모드(light·dark·고대비·노랑) 테마 패리티 — `!important` 화면오버라이드 불요 확인.
- 대비 4.5:1(신규 토큰 fg/bg) · 비색큐(상태칩 텍스트 라벨 유지).
- 회귀: 기존 골든·a11y 테스트 0 회귀.

## 10. 레인·충돌
- W: `Plan&Source/**`·`src/test/**`·`src/**/*.test.tsx`. U: `globals.css`·화면. main 직접 push 금지.
- 충돌 회피: #79(B2)·#80(provider)·#81(P1). P1(#81) 브랜딩 교체와 이 P2 는 다른 파일군이라 독립(앵커 홈은 P1 대상 아님).
