# P7 웨이브4 — hover / press / disabled 토큰 시스템 (goala)

> 저자: W(설계·검증). 구현: U — `src/app/globals.css` + `src/components/ui/buttonStyles.ts` +
> `src/components/ui/Button.tsx` + 매핑표(§7)의 화면 파일.
> 계약: `src/test/hoverPressTokens.test.ts` (globals 토큰 선언 · 토큰 AA 4모드 실측 · 프리미티브 ·
> 전역 fs-scan · disabled 채택). 현재 main 기준 **48 RED / 1 green**(green=press 스케일 화이트리스트
> 회귀가드, 이미 청정).
> 선례: P2 토큰토대(§3-2 가산) · P6 다크토큰(4모드 재정의) · P7 accent 워크플로 · primary-hover.
> AA: 모든 값은 sRGB 상대휘도(WCAG 2.x)로 **W 독립 재계산**했고, 지정 foreground 위에서 4모드
> ≥4.5:1 을 만족한다(계약 Part B 가 U 가 넣은 실제 값으로 이 계산을 재수행).

---

## 1. 문제 정의 (감사 evidence C2/C3/C4/C5/D3)

| # | 문제 | 심각도 |
|---|------|--------|
| C2/D7 | 전용 hover 토큰이 `primary`/`sidebar` 에만 존재. `hero`/`danger`/`positive`/`warning`/`muted` 는 `hover:opacity-90`(42곳)로 대체 | med·핵심 |
| C3 | `hover:opacity-90` + `transition-colors` 29곳 — `transition-colors` 는 **opacity 를 전이 못함** → hover 가 즉발(전이 없음)·반투명(대비 저하) | med |
| C5 | muted hover 관용구 이원화: `hover:bg-muted`(~24곳) vs `hover:opacity-90`(muted 표면 17곳) | med |
| C4 | press(`active:scale-*`)가 손수 CTA 에만 있고 **Button/LinkButton 프리미티브엔 없음** → 프리미티브 버튼은 눌러도 무반응(2트랙 결함). 손수 CTA 3곳은 `transition-colors`+`active:scale` 로 scale 이 즉발(jank) | med |
| D3 | muted 반려/대기 버튼 `disabled:opacity-50` → 라벨 AA 붕괴(base 5.53 light/4.74 dark → 2.05/2.19) | med |

### 핵심 진단 — 왜 opacity 가 틀렸나

`transition-colors` 는 `color`·`background-color`·`border-color` 만 전이한다. `opacity` 는 그 목록에
없다 → `hover:opacity-90` 는 **전이 없이 즉발**하고, 90% 불투명은 배경이 비쳐 **대비를 낮춘다**.
즉 hover 가 "더 또렷"해야 하는데 오히려 **흐려진다**. 해법은 opacity 가 아니라 **배경색을 바꾸는
전용 hover 토큰**(primary-hover 선례와 동일 원리).

---

## 2. 설계 원리 — 두 규칙

### 규칙 1: base 토큰의 모드 구조가 hover 토큰의 구조를 결정한다

- `danger`·`positive`·`warning` 의 base 는 **4모드 상수**(`:root`/`@theme` 에만, HC/dark/yellow 재정의
  없음) → 각 hover 도 **`@theme` 단일값 하나**면 전모드를 덮는다(primary-hover 패턴).
- `hero`·`muted` 는 **모드별로 재정의**되는 토큰(hero=라이트/다크는 어두운 표면, HC는 흰 반전 표면;
  muted=밝기 모드적응) → 각 hover 도 **4모드 전 재정의** 필요.

### 규칙 2: hover 방향은 '모드'가 아니라 '그 위 글자(foreground)'를 따른다

- **흰 글자 솔리드**(danger/positive): hover 에 **어둡게** → 대비 상승.
- **밝은 글자 위 어두운 표면**(hero, 라이트/다크/노랑): hover 에 **밝게** → 대비 유지·상승.
- **HC 반전 hero**(검은 글자 위 흰 표면): hover 에 **회색으로 살짝 어둡게**(흰과 구분되되 검은 글자
  최대 대비 유지).

---

## 3. hover 토큰 5종 — `@theme` + 모드 재정의 값

값 표기: `hsl(H S% L%)`. "지정 fg" = 그 hover 표면 위에 실제로 얹히는 foreground 토큰(대비 계산 기준).

### 3-1. `--color-danger-hover` (4모드 상수, `@theme` 단일값)

```css
/* @theme 에 추가 (danger 정의 부근) */
--color-danger-hover: hsl(0 72% 42%);
```
- base `danger`=hsl(0 72% 50%), fg=`danger-foreground`(흰). base 흰 대비 4.89 → **hover 6.47**(어둡게 → 상승).
- HC/dark/yellow 재정의 **없음**(base 가 상수라 단일값이 전모드 유효).

### 3-2. `--color-positive-hover` (4모드 상수)

```css
--color-positive-hover: hsl(130 55% 26%);
```
- base `positive`=hsl(130 55% 32%), fg=`positive-foreground`(흰). base 5.08 → **hover 6.96**.

### 3-3. `--color-warning-hover` (4모드 상수) — ★ foreground 교체가 전제

```css
--color-warning-hover: hsl(32 90% 44%);
```
- base `warning`=hsl(32 90% 48%). **선행 결함**: `warning` 위 **흰 글자 = 2.75:1(AA FAIL, 기존부터)**.
  warning-hover 위 흰 글자도 3.24:1 FAIL.
- ★ **필수 전제(선택 아님)**: warning 버튼의 fg 를 `text-primary-foreground`(흰) → 기존 토큰
  **`--color-warning-foreground`=hsl(28 90% 13%)**(어두운 앰버)로 교체. 그러면 base 5.44:1(AA)·
  hover **4.59:1(AA)**. 흰 글자로 출고하면 base·hover 둘 다 sub-AA.

### 3-4. `--color-hero-hover` (4모드 전 재정의 필수)

```css
/* @theme */
--color-hero-hover: hsl(222 47% 16%);        /* 라이트: hero 11%→16% 밝게 */
/* html.high-contrast */
--color-hero-hover: hsl(0 0% 92%);           /* HC: hero=#fff/글자#000 → hover 회색(구분+검정 대비) */
/* html.dark-mode */
--color-hero-hover: hsl(222 47% 22%);        /* 다크: hero 16%→22% 밝게 */
/* html.yellow-bg */
--color-hero-hover: hsl(222 47% 16%);        /* 노랑=라이트 미러(니치 모드 표류방지 명시) */
```
- fg=`hero-foreground`(라이트/다크/노랑=밝은 글자, HC=#000). 대비: 라이트 15.24 · HC 17.62 ·
  다크 11.89 · 노랑 15.24 — 전부 PASS. hero 는 어두운 표면이므로 hover 가 **밝아져야** 대비가 산다.

### 3-5. `--color-muted-hover` (4모드 전 재정의 필수)

```css
/* @theme */
--color-muted-hover: hsl(220 20% 88%);       /* 라이트: muted 93%→88% 어둡게 */
/* html.high-contrast */
--color-muted-hover: hsl(220 20% 85%);       /* HC: 글자 #000 강제 */
/* html.dark-mode */
--color-muted-hover: hsl(217 32% 22%);       /* 다크: muted 18%→22% 밝게 */
/* html.yellow-bg */
--color-muted-hover: hsl(220 20% 88%);       /* 노랑=라이트 미러 */
```
- fg=**`--color-foreground`**(실제 버튼 소비자 secondary/ghost 는 text-foreground): 라이트 11.67 ·
  HC 14.41 · 다크 11.15 · 노랑 11.67 — 전부 PASS(≥11:1 여유).
- ★ **caveat(다크)**: `muted-foreground`(chip/tab)를 muted-hover 위에 얹으면 **다크 4.16:1 FAIL**
  (다크 muted base 자체가 4.74 라 밝히면 muted-foreground 가 무너짐). → **chip/tab 은 hover 시
  `text-foreground` 로 전환**해야 한다(§7 매핑의 muted-hover 대상 중 `text-muted-foreground` 병용 라인).

---

## 4. press 표준 — `active:scale-[0.98]` 을 프리미티브에 내장

### 표준값·화이트리스트
- **표준 = `active:scale-[0.98]`** — `BUTTON_BASE_CLASS`(buttonStyles.ts)에 내장 → Button·LinkButton 이
  무료로 press 획득(현재 프리미티브엔 press **전무** = C4 2트랙 결함).
- 화이트리스트(표준 외 합법): `active:scale-95`(아이콘버튼/카드/FAB 어포던스) · `active:scale-90`
  (SelfCheckFeedback 이모지 2곳, 의도적 유희 예외 — 유지 또는 95로 흡수). 그 외 값 금지.

### ★ 필수 동반 변경 — transition 이 transform 을 전이해야
`BUTTON_BASE_CLASS` 의 `transition-colors` 는 **scale(transform)을 전이 못함** → scale 이 즉발(jank).

```ts
// 현재
const BUTTON_BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors'
// 목표(예시)
const BUTTON_BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-xl font-bold ' +
  'transition-[color,background-color,border-color,box-shadow,transform] ' +
  'active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100'
```
- `transition-all` 로 대체해도 무방(계약은 `transition-all` 또는 `transition-[…transform…]` 허용).
- `motion-reduce:*` 가드 = `prefers-reduced-motion` 존중(전역 L398 과 이중 안전).

### 손수 jank 3곳 — transform 전이로 교정 or 프리미티브 회수
`transition-colors`+`active:scale` 페어링 = scale 즉발. 대상:
`admin/participants/new:171` · `supporter/applications/new:262` · `supporter/page.tsx:26`
(+ secondary 2곳 `supporter/page.tsx:33,40`). → `transition-all`(또는 transform 포함 transition)로
바꾸거나 Button/LinkButton 으로 회수.

> **게이트**: press 는 jsdom 이 `:active` 를 관측 못하므로 **fs-scan 만 유효**
> (buttonStyles 에 표준+transform전이 내장 · 화이트리스트 밖 값 0 · `transition-colors`+`active:scale`
> 페어링 0).

---

## 5. disabled 전용 토큰 — 규칙이 아니라 토큰

`disabled:opacity-*` 는 fg·bg 를 **동시에 배경 쪽으로** 흐려 AA 를 **보장 불가**(muted 반려버튼:
base 5.53 light/4.74 dark → opacity-50 시 2.05/2.19, 라벨 판독 불가). → 전용 4모드 토큰.

```css
/* @theme */
--color-disabled-bg: hsl(220 16% 90%);
--color-disabled-fg: hsl(220 14% 38%);       /* 5.28:1 */
/* html.high-contrast */
--color-disabled-bg: hsl(0 0% 90%);
--color-disabled-fg: #000000;                /* 16.83:1 (회색면=disabled 신호, 검정 글자 최대) */
/* html.dark-mode */
--color-disabled-bg: hsl(217 32% 22%);
--color-disabled-fg: hsl(215 15% 68%);       /* 5.41:1 */
/* html.yellow-bg */
--color-disabled-bg: hsl(220 16% 90%);       /* =라이트 */
--color-disabled-fg: hsl(220 14% 38%);       /* 5.28:1 */
```
- Tailwind 클래스: `disabled:bg-disabled-bg` `disabled:text-disabled-fg`(토큰명과 1:1).
- `disabled:pointer-events-none`/`disabled:cursor-not-allowed` 는 **유지**(대비 신호가 아니라 어포던스).
- login `disabled:opacity-60`(2곳)은 **스피너/로딩 상태**면 유지 가능(저항 disabled 라벨이 아님).

### 채택 범위(이 웨이브)
1. `Button.tsx:41` 프리미티브 → `disabled:bg-disabled-bg disabled:text-disabled-fg`
   (Button 경유 모든 disabled 상태를 한 번에 교정 — 최대 blast-radius).
2. muted 앵커 2곳: `ReviewQueueClient.tsx:100` · `ApplicationDetailClient.tsx:256`.
> **follow-on(비게이트)**: 손수 hero 솔리드 버튼의 `disabled:opacity-50`(~다수)는 Button 프리미티브
> 회수 또는 disabled 토큰 이관 권장 — 이번 웨이브 과대 RED 방지 위해 계약 게이트에서 제외.

---

## 6. AA 표 (W 독립 재계산 · 4모드 · 지정 fg 위)

| 토큰 | 지정 fg | light | HC | dark | yellow | 판정 |
|------|---------|------|----|------|--------|------|
| hero-hover | hero-foreground / HC #000 | 15.24 | 17.62 | 11.89 | 15.24 | PASS |
| danger-hover | danger-foreground(흰) | 6.48 | 6.48 | 6.48 | 6.48 | PASS |
| positive-hover | positive-foreground(흰) | 6.93 | 6.93 | 6.93 | 6.93 | PASS |
| warning-hover | **warning-foreground**(28 90 13) | 4.59 | 4.59 | 4.59 | 4.59 | PASS¹ |
| muted-hover | **foreground**(버튼) | 11.67 | 14.41 | 11.15 | 11.67 | PASS |
| muted-hover | muted-foreground(chip) | 4.84 | — | **4.16** | 4.84 | 다크 FAIL² |
| disabled | disabled-fg/bg | 5.28 | 16.83 | 5.41 | 5.28 | PASS |

- **①** warning-hover 는 **fg 교체가 전제**. 흰 글자로는 base 2.75·hover 3.24 로 둘 다 FAIL.
- **②** muted-hover 위 muted-foreground 는 **다크 4.16(FAIL)** — 값 오류가 아니라 범위 문제(다크 muted
  base 4.74 라 밝히면 필연). 버튼은 text-foreground(11.15) 라 안전; **chip/tab 은 hover 시
  text-foreground 로 전환**해야 AA 유지.

> base(선행) 대비 참고: danger 흰 4.89 · positive 흰 5.08 · **warning 흰 2.75(선행 FAIL)** ·
> warning+warning-fg 5.44.

---

## 7. `hover:opacity-90` 매핑표 (42곳 / 28파일)

variant 분포: `bg-hero` 18 · `bg-muted` 17 · `bg-positive` 3 · `bg-danger-bg` 2 · `bg-warning` 1 · `bg-danger` 1.

### 7-1. 프리미티브 진실원천 (buttonStyles.ts `BUTTON_VARIANT_CLASS` — 최대 blast-radius)

| variant | 현재 | 목표 |
|---------|------|------|
| danger | `bg-danger text-primary-foreground hover:opacity-90` | `bg-danger text-danger-foreground hover:bg-danger-hover` |
| positive | `bg-positive text-primary-foreground hover:opacity-90` | `bg-positive text-positive-foreground hover:bg-positive-hover` |
| warning | `bg-warning text-primary-foreground hover:opacity-90` | `bg-warning **text-warning-foreground** hover:bg-warning-hover` |
| secondary | `bg-card text-foreground ring-1 ring-border hover:bg-muted` | `… hover:bg-muted-hover` (C5) |
| ghost | `bg-transparent text-foreground hover:bg-muted` | `… hover:bg-muted-hover` (C5) |

> danger/positive fg 는 이미 흰(danger-foreground/positive-foreground = 흰 상수)이라 실질 동일하지만
> 시맨틱 정합을 위해 전용 fg 토큰으로 통일 권장. warning 만 **fg 값 변화**(흰→어두운 앰버)라 필수.

### 7-2. 화면 파일 (fs-scan 이 강제)

- **bg-hero 18곳**: `hover:opacity-90` → `hover:bg-hero-hover`.
- **bg-muted 표면 17곳**: `hover:opacity-90` → `hover:bg-muted-hover`(+ 옛 `hover:bg-muted` ~24곳도
  `hover:bg-muted-hover` 로 통일 = C5 단일 관용구). **다크 chip/tab**(예: MapTabsClient·MapClient·
  NetworkGraphClient 탭 생성기의 `text-muted-foreground … hover:bg-muted`)는 hover 시
  `text-foreground` 병행(AA caveat②).
- **bg-positive 2곳**(ReviewQueueClient:93 · ApplicationDetailClient:249): → `hover:bg-positive-hover`
  (프리미티브 미경유 손수 버튼).
- **bg-danger-bg 2곳**(MoreMenuClient:295 · ApplicationDetailClient:326): 소프트틴트 버튼(base 6.07 AA).
  → 전용 `--color-danger-bg-hover`(예: hsl(0 80% 90%)=5.13) 신설 후 `hover:bg-danger-bg-hover`,
  또는 opacity 만 제거(hover 무효화는 지양). **본 계약은 hover:opacity-90 근절만 강제** — danger-bg-hover
  토큰 신설은 U 재량(권장).

### 7-3. 기존 정답 선례(복사 대상)
`hover:bg-primary-hover` 이미 라이브: HelpSlideshow:88/95 · NoBudgetGate:42 · EmptyState:51 ·
MoreMenuClient:69 · admin/participants/page:73. `sidebar-hover` = hero-hover/muted-hover 의 4모드
재정의 골드 스탠다드.

---

## 8. 구현 체크리스트 (U)

1. **globals.css**: `@theme` 에 danger/positive/warning-hover(상수 3) + hero-hover·muted-hover·
   disabled-bg·disabled-fg 라이트값. `html.high-contrast`·`html.dark-mode`·`html.yellow-bg` 블록에
   hero-hover·muted-hover·disabled-bg·disabled-fg 재정의(§3·§5 값).
2. **buttonStyles.ts**: `BUTTON_VARIANT_CLASS` §7-1 표대로(warning fg 교체 포함). `BUTTON_BASE_CLASS`
   에 §4 press 표준(active:scale-[0.98] + transform 전이 + motion-reduce) 내장.
3. **Button.tsx**: `disabled:opacity-50` → `disabled:bg-disabled-bg disabled:text-disabled-fg`
   (pointer-events/cursor 유지).
4. **화면 42곳**: §7-2 매핑(hover:opacity-90 근절 · muted 단일 관용구 · positive/hero/danger-bg).
   손수 press jank 3곳 transition 교정. muted 앵커 2곳 disabled 토큰.
5. **게이트**: `npx vitest run src/test/hoverPressTokens.test.ts`(49 green) · `npm test` 무손상 ·
   `tsc --noEmit` · `npm run build`.

---

## 9. 계약 게이트 요약 (`src/test/hoverPressTokens.test.ts`)

| Part | 검증 | 현재 |
|------|------|------|
| A | globals.css 가 hover 5종 + disabled 2종 선언, hero/muted/disabled 4모드 재정의 | RED |
| B | 각 토큰을 지정 fg 위에서 4모드 실측 대비 계산 ≥4.5:1 (U 실제값 재계산) | RED |
| C | buttonStyles 솔리드 variant hover:bg-*-hover · warning fg 교체 · muted 단일 · BUTTON_BASE press+transform+reduce · Button disabled 토큰 | RED |
| D | 전역 fs-scan: hover:opacity-90=0 · hover:bg-muted(비-hover)=0 · active:scale 화이트리스트 · transition-colors+active:scale 페어링=0 | 대부분 RED(화이트리스트만 green) |
| E | muted 앵커 2곳 disabled 토큰 | RED |

> **W→U 3대 경고(초록 빌드가 못 잡는 것)**: (a) warning 솔리드 base 는 **이미 AA FAIL** — warning-hover 는
> fg 를 warning-foreground 로 바꿔야만 AA(2.75→5.44 base·4.59 hover). (b) 다크 muted-foreground-on-
> muted 는 선행 marginal(4.74) — muted-hover 는 text-foreground(버튼) 기준 검증, chip/tab 은
> text-foreground 로 전환. (c) `disabled:opacity-50` 은 수학적으로 AA 보장 불가 → 전용 토큰.
