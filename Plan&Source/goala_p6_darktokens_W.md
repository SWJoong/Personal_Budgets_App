# P6 다크-표면 시맨틱 토큰 서브웨이브 — AdminSidebar (goala)

> 저자: W(설계·검증). 구현: U(app-6c) — `src/app/globals.css` + `AdminSidebar.tsx` 치환.
> 계약: `src/test/tokenFoundation.test.ts` `TOKENIZED_FILES` 에 `AdminSidebar.tsx` 추가(RED).
> 선례: P2 토큰토대(§3-2 가산 패턴) · P3~P5. Phase A(`test/w-p6-a11y`)와는 `TOKENIZED_FILES` 배열만 교차.

---

## 1. 문제 정의 — 왜 라이트 시맨틱 토큰을 재사용할 수 없는가

`AdminSidebar`(및 모바일 상단바 `SupporterLayoutClient`)는 앱 유일한 **다크 반전 표면**이다:
`bg-gradient-to-b from-slate-900 to-slate-800` 위에 `text-white`×다수 + `text-slate-300/400` 보조 +
`bg-white/5·/10` hover/활성 오버레이 + `bg-blue-400` pulse 점 + amber 계열 SoonBadge.

P2~P5 에서 정착한 라이트-우선 시맨틱 토큰은 재사용 불가:

- `--color-foreground`/`--color-muted-foreground` = **밝은 배경용 어두운 글씨**. 다크 사이드바 위에
  얹으면 "검은 배경 위 검은 글씨"가 되어 소실.
- `--color-card` = 흰색 면. 다크 표면 오버레이로 부적합.
- `--color-hero` **재사용 금지**: hero 는 고대비 모드에서 `#fff`/`#000` 로 **반전**된다
  (globals.css L382-383). 사이드바는 고대비에서도 **다크 패널을 유지**해야 하므로(흰 사이드바는
  본문과 구분 소실) hero 의 반전 계약과 정반대다.

→ 결론: **전용 다크-표면 시맨틱 토큰 세트**(`--color-sidebar-*`)를 신설한다. P2 처럼 `@theme` 가산 +
3개 테마 블록(dark/high-contrast/yellow) 재정의. 시맨틱 클래스명은 팔레트어(slate/blue/amber)·`white`
를 포함하지 않으므로 tokenFoundation 스캐너(RAW_SCALE·RAW_WHITE)에 **non-hit** → 등재 후 green 경로.

---

## 2. 그라디언트 처리 방식 — 단색 `--color-sidebar` 로 붕괴 (옵션 A, 필수)

**채택: 옵션 A** — `bg-gradient-to-b from-slate-900 to-slate-800`(3클래스) → `bg-sidebar`(단색 1클래스).

### 결정적 근거

globals.css L453-455 의 **유니버설 규칙**:

```css
html.high-contrast *,
html.dark-mode * { background-image: none !important; }
```

`bg-gradient-to-b` 는 CSS `background-image`(linear-gradient) 로 구현된다. 사이드바는
`.participant-view` 스코프의 보호 예외를 받지 못하므로, **다크·고대비 두 모드에서 현재 그라디언트가
이미 소실**된다 → 텍스트가 뒤 컨테이너 위에 뜨는 **잠재 버그가 이미 존재**. 단색 background-color
토큰으로 붕괴하면 이 버그가 함께 해소된다.

- 옵션 B-변형(arbitrary-var 그라디언트 `from-[var(--sidebar-from)] to-[var(--sidebar-to)]`)은 raw
  스캐너는 통과하나 **여전히 background-image** 라서 `background-image:none` 에 지워짐 → 부적합.
- 옵션 B(그라디언트 유지)를 강행하려면 L453-455 를 `.participant-view` 로 스코프 축소하는 globals.css
  수정이 추가로 필요하고, 4모드 AA 를 "밝은 끝(slate-800 상당)" 최악값으로 계약해야 함 → 비용·리스크 큼.
- 프로젝트 §4 "무광택 단색" 원칙과도 정합.

**결론: 단일 `--color-sidebar` background-color 토큰.**

---

## 3. 토큰 세트 스펙 (12종) — `@theme` + 3모드 블록

단색 `background-color` 기반. Tailwind4 `@theme` 에 `--color-<name>` 을 두면 `bg-/text-/border-/ring-<name>`
유틸이 자동 생성된다(추가 유틸 정의 불필요). 대비율은 각 모드 `--color-sidebar` 배경 기준 WCAG
`(L₁+0.05)/(L₂+0.05)`.

| 토큰명 | 용도(대체하는 raw 역할) | 라이트기본(=노랑 상속) | 다크(html.dark-mode) | 고대비(html.high-contrast) | 노랑(html.yellow-bg) | AA 대비율(사이드바 배경 대비) |
|---|---|---|---|---|---|---|
| `--color-sidebar` | 사이드바 표면(그라디언트 붕괴, 단색) | `hsl(222 47% 11%)` | `hsl(222 47% 13%)` | `#000000` | =라이트(명시 재선언) | 배경 기준값 |
| `--color-sidebar-foreground` | 기본 본문 텍스트(`text-slate-300`) | `hsl(214 20% 82%)` | `hsl(214 20% 82%)` | `#ffffff` | =라이트 | 라 11.3 / 다 11.0 / 고 21 / 노 11.3 |
| `--color-sidebar-muted-foreground` | 보조 텍스트·아이콘(`text-slate-400`) | `hsl(215 20% 72%)` | `hsl(215 20% 72%)` | `#ffffff`(회색 제거) | =라이트 | 라 8.5 / 다 8.3 / 고 21 / 노 8.5 |
| `--color-sidebar-strong` | 활성·hover·로고 강조(`text-white`) | `hsl(0 0% 100%)` | `hsl(0 0% 100%)` | `#ffffff` | =라이트 | 라 17.6 / 다 16.9 / 고 21 / 노 17.6 |
| `--color-sidebar-elevated` | 정적 카드·토글 기본면(`bg-white/5`) | `hsl(222 35% 15%)` | `hsl(222 35% 16%)` | `#000000`(테두리로 구분) | =라이트 | 면; muted 텍스트 7.8(라)·≥7(다) |
| `--color-sidebar-hover` | hover 오버레이(`bg-white/5·/10`) | `hsl(222 40% 18%)` | `hsl(222 40% 19%)` | `#1a1a1a` | =라이트 | 면; strong 텍스트 14.9(라) |
| `--color-sidebar-active` | 활성 배경(`bg-white/10`·토글 `/15`) | `hsl(222 40% 23%)` | `hsl(222 40% 24%)` | `#000000`(+2px outline) | =라이트 | 면; strong 텍스트 13.0(라)/12.6(다) |
| `--color-sidebar-border` | 구분선 `h-px`·경계(`bg-white/10`) | `hsl(217 30% 30%)` | `hsl(217 30% 32%)` | `#ffffff`(2px) | =라이트 | 장식 구분선(1.4.11 면제); 고대비 21 |
| `--color-sidebar-marker` | 활성 pulse 점(`bg-blue-400`, 비텍스트) | `hsl(213 94% 68%)` | `hsl(213 94% 68%)` | `#ffffff` | =라이트 | 라 6.9 / 다 6.8 / 고 21 (그래픽 ≥3:1) |
| `--color-sidebar-badge` | SoonBadge 배경(`bg-amber-400/20`) | `hsl(38 60% 24%)` | `hsl(38 60% 24%)` | `#ffffff` | =라이트 | 배지면 |
| `--color-sidebar-badge-foreground` | SoonBadge 텍스트(`text-amber-300`, 9px 굵게) | `hsl(40 96% 76%)` | `hsl(40 96% 76%)` | `#000000` | =라이트 | 배지 대비 6.2(라) / 21(고) — 소형텍스트 4.5 충족 |
| `--color-sidebar-badge-ring` | SoonBadge ring(`ring-amber-400/30`, 비텍스트) | `hsl(38 70% 40%)` | `hsl(38 70% 40%)` | `#000000` | =라이트 | 사이드바 대비 4.7(라, 그래픽 ≥3) |

### 3-2. globals.css 추가 위치 (P2 가산 패턴)

1. **`@theme`**(L31 `--color-hero` 세트 인접, `--color-warning-*` 근처): 위 표의 **라이트기본** 값 12종을
   `--color-sidebar-*` 로 추가. 주석 `/* P6: 다크-표면 시맨틱 토큰 — Plan&Source/goala_p6_darktokens_W.md */`.
2. **`html.dark-mode { … }`**(L459~): 위 **다크** 열 값 재정의(밝기 미세 상향만).
3. **`html.high-contrast { … }`**(L372~): 위 **고대비** 열 값 재정의(순흑백 + 회색 muted 폐기).
4. **`html.yellow-bg { … }`**(L631~638): **라이트값 명시 미러**(의도 주석 `/* 사이드바는 노랑 배경과
   무관하게 다크 유지 */`). 노랑 모드는 라이트를 상속하지만, 다른 hero 계열이 노랑에서 재정의되므로
   사이드바 세트도 명시적으로 라이트값을 재선언해 상속 표류를 막는다.

> `--color-sidebar` 토큰은 raw `.bg-white`·`.participant-view` 강제 규칙 스코프 **밖**이므로 기존
> dark-mode/high-contrast 오버라이드와 충돌 없음.

---

## 4. AA 검증 매트릭스 (4모드 × 핵심 항목)

기준: 텍스트 ≥4.5:1(AA), 대형/그래픽 ≥3:1(1.4.11).

- **(a) foreground ↔ sidebar**: 라 11.3 · 다 11.0 · 고 21 · 노 11.3 → 전부 ≥7 ✔ (다크 sidebar 13%가 라이트 11%보다 밝아 라이트보다 소폭 낮음이 정상)
- **(b) muted-foreground ↔ sidebar**: 라 8.5 · 다 8.3 · 고 21 · 노 8.5 → 전부 ≥4.5 ✔
- **(c) 활성 텍스트(strong) ↔ active 배경**: 라 13.0 · 다 12.6 · 고 21(흑백) · 노 13.0 → ✔
- **(d) 비텍스트(marker 점 / badge ring) ↔ sidebar**: marker 6.9~21, ring 4.7~21 → ≥3 ✔
  (구분선 `--color-sidebar-border` 는 장식, 1.4.11 면제)
- **(e) 고대비**: 전 항목 순흑백 21:1, muted 회색 **폐기**. 위계는 굵기·들여쓰기·아이콘·2px 테두리로
  **비색(non-color) 큐** 표현.

### 4-2. 근거 대비 계산 (sRGB 상대휘도 L)

L(sidebar 라 11%)=0.0095, L(sidebar 다 13%)=0.0112, L(fg 82%)=0.624, L(muted 72%)=0.457,
L(strong 100%)=1.0, L(marker blue-400)=0.363, L(badge-bg)=0.072, L(badge-fg)=0.704.

예:
- fg/sidebar = (0.624+0.05)/(0.0095+0.05) = **11.3:1**
- muted/sidebar = (0.457+0.05)/(0.0595) = **8.5:1**
- strong/sidebar = (1.0+0.05)/(0.0595) = **17.6:1**
- marker/sidebar = (0.363+0.05)/(0.0595) = **6.9:1**
- badge-fg/badge-bg = (0.704+0.05)/(0.072+0.05) = **6.2:1**
- 고대비 `#fff`/`#000` = **21:1**

---

## 5. AdminSidebar 클래스 → 토큰 매핑 (구현 체크리스트, U)

라인 번호는 origin/main `b2f47b1` 기준(Phase A rebase 후 재확인).

| 위치 | before(raw) | after(시맨틱) |
|---|---|---|
| L92 aside 표면 | `bg-gradient-to-b from-slate-900 to-slate-800` | `bg-sidebar` |
| L92 aside 기본 텍스트 | `text-slate-300` | `text-sidebar-foreground` |
| L97 로고 제목 | `text-white` | `text-sidebar-strong` |
| L98 서브타이틀 '관리자' | `text-slate-400` | `text-sidebar-muted-foreground` |
| L105 토글버튼 | `bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white` | `bg-sidebar-elevated hover:bg-sidebar-active text-sidebar-muted-foreground hover:text-sidebar-strong` |
| L112·L188 구분선 | `h-px bg-white/10` | `h-px bg-sidebar-border` |
| L132 주메뉴 활성 | `bg-white/10 text-white` | `bg-sidebar-active text-sidebar-strong` |
| L132 주메뉴 비활성 hover | `hover:bg-white/5 hover:text-white` | `hover:bg-sidebar-hover hover:text-sidebar-strong` |
| L142 활성 점 | `bg-blue-400` (animate-pulse-gentle 유지) | `bg-sidebar-marker` |
| L151 서브 토글버튼 | `hover:bg-white/10 text-slate-400 hover:text-white` | `hover:bg-sidebar-hover text-sidebar-muted-foreground hover:text-sidebar-strong` |
| L170 서브 활성 | `bg-white/10 text-white` | `bg-sidebar-active text-sidebar-strong` |
| L171 서브 비활성 | `text-slate-400 hover:bg-white/5 hover:text-white` | `text-sidebar-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-strong` |
| L192 빠른설정 버튼 | `text-slate-400 hover:text-white hover:bg-white/5` | `text-sidebar-muted-foreground hover:text-sidebar-strong hover:bg-sidebar-hover` |
| L204 빠른설정 항목 | `text-slate-400 hover:bg-white/5 hover:text-white` | `text-sidebar-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-strong` |
| L218 유저 카드 | `bg-white/5` | `bg-sidebar-elevated` |
| L219 이메일 | `text-slate-400` | `text-sidebar-muted-foreground` |
| L225 로그아웃 | `hover:bg-white/5 text-slate-400 hover:text-white` | `hover:bg-sidebar-hover text-sidebar-muted-foreground hover:text-sidebar-strong` |
| L71 SoonBadge | `bg-amber-400/20 text-amber-300 ring-amber-400/30` | `bg-sidebar-badge text-sidebar-badge-foreground ring-sidebar-badge-ring` |

### 5-2. 고대비 상태 구분 노트 (필수)

고대비에서 `active`/`hover` 가 `#000` 이 되어 배경만으로는 활성 상태를 구분할 수 없다. 배경 반전이 아닌
**테두리(outline)** 로 상태를 구분한다.

**★확정 구현 경로 (리뷰 반영 — 시각 회귀 방지):** 12토큰에 전용 outline 토큰 1개를 추가한다(=13토큰).

| 토큰명 | purpose | 라이트기본 | 다크 | 고대비 | 노랑 |
|---|---|---|---|---|---|
| `--color-sidebar-active-outline` | 활성 항목 테두리(비텍스트 상태지시자) | `transparent` | `transparent` | `#ffffff` | `transparent` |

AdminSidebar 활성 분기에 `outline outline-2 outline-sidebar-active-outline` 을 **상시 부착**한다.
- 라이트/다크/노랑: `transparent` → 렌더되지만 **투명이라 시각 회귀 0**(상태 구분은 기존 배경 명도차로 충분).
- 고대비: `#ffffff` → 흰 테두리가 드러나 `#000` 활성 배경 위에서 상태를 구분(WCAG 1.4.1 색만-의존 회피).

`high-contrast:` Tailwind variant 를 쓰지 않고 **토큰 값 승격만**으로 처리 → 4모드 일관·기존 P2 재정의 패턴과 동형.
비텍스트 지시자라 텍스트 AA(4.5:1) 대상 아님(고대비 `#fff`/`#000`=21:1, 그래픽 ≥3:1 자동 충족).

### 5-3. 제2 다크표면 — SupporterLayoutClient (선택, 함께 권장)

`src/app/(supporter)/SupporterLayoutClient.tsx` 모바일 상단바도 동일 다크표면:
L63 `bg-slate-900 text-white border-slate-700`, L68·L94 `bg-white/10`. 동일 토큰 세트
(`bg-sidebar` / `text-sidebar-strong` / `border-sidebar-border` / `bg-sidebar-active`)로 재사용 치환.
계약에 함께 등재할지는 U 판단(라인 이관 정확도 확인 후). **이번 서브웨이브 RED 앵커는 AdminSidebar 단일**.

---

## 6. 계약 메커니즘 & 레인

- **W(이 문서)**: `tokenFoundation.test.ts` `TOKENIZED_FILES` 에 `AdminSidebar.tsx` 추가 → 현재 raw
  `from-slate-900`·`text-slate-300`·`text-white`·`bg-white/N`·`bg-blue-400`·`bg-amber-400/20`·
  `text-amber-300`·`ring-amber-400/30` 가 RAW_SCALE·RAW_WHITE 에 걸려 **RED**.
- **U(app-6c)**: globals.css 4블록(@theme + dark-mode + high-contrast + yellow-bg)에 §3 토큰 세트 추가 +
  §5 매핑표대로 AdminSidebar raw→시맨틱 치환 → **green**(시맨틱 클래스는 스캐너 non-hit).
- **정정**: 이전 메모의 "AdminSidebar 는 이미 tokenFoundation L53 에 등재"는 부정확 —
  실제로는 배열이 아니라 주석에만 등장했다. 이 서브웨이브가 **배열에 실제로 추가**한다.
- **Phase A 교차**: `test/w-p6-a11y`(7파일 a11y)와 `TOKENIZED_FILES` 배열만 겹친다 →
  이 브랜치는 origin/main 기준 저작, **Phase A 머지 후 rebase**해 배열을 union.
- **hero 재사용 금지 재확인**: `--color-hero` 는 고대비에서 `#fff`/`#000` 반전(L382-383)이라 사이드바
  (고대비에도 다크 유지)와 정반대 계약. 별도 세트가 필수인 이유.

---

## 7. 완료 기준(DoD)

- [ ] `npx vitest run src/test/tokenFoundation.test.ts` → AdminSidebar 케이스 RED(raw 검출), 기존 케이스 무손상.
- [ ] U: globals.css 4블록 토큰 추가 + AdminSidebar 치환 후 동일 테스트 **green**.
- [ ] 4모드 수동 스모크: 라이트/다크/고대비/노랑에서 사이드바 텍스트↔배경 대비 §4 매트릭스 충족 육안 확인.
- [ ] 고대비에서 활성 항목이 테두리(outline)로 구분됨(§5-2).
- [ ] `npm run build` green.
