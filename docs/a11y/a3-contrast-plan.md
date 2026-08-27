# A3 — 명도 대비(Contrast) 전면 정리 계획 (초안)

> KRDS/KWCAG Phase A 잔여 항목. **U 초안 · W DevTools 검증(W6) 동반.**
> 목표: 기본(라이트) 테마에서 텍스트/배경 대비 **WCAG AA 이상**(일반 4.5:1, 큰 텍스트 3:1).
> ⚠️ 대비는 **jsx-a11y(Phase D)로 못 잡는다**(색 계산 필요) → 이 문서 + DevTools CSS Overview 로 관리.

## 1. 토큰 대비값 (흰 배경 #FFF 기준, 근사 — 정확값은 DevTools)

| 토큰 | 색 | on 흰색 | 판정 |
|------|-----|---------|------|
| `text-zinc-300` | #D4D4D8 | ≈ 1.5:1 | ✗ 심각 |
| `text-zinc-400` | #A1A1AA | ≈ 2.6:1 | ✗ (일반·큰 텍스트 모두 실패) |
| `text-zinc-500` | #71717A | ≈ 4.8:1 | ✓ AA 일반 |
| `text-zinc-600` | #52525B | ≈ 7.4:1 | ✓ AAA |
| `text-zinc-400` | on `zinc-900`(#18181B) | ≈ 6.3:1 | ✓ (어두운 표면) |

## 2. 교체 규칙

- **라이트 배경 · 보조/작은 라벨·배지** → `text-zinc-400` → **`text-zinc-500`** (최소 AA).
- **라이트 배경 · 본문·빈 상태·의미 있는 안내문** → `text-zinc-400` → **`text-zinc-600`** (Easy Read 권장 대비).
- **`text-zinc-300`(텍스트)** → **`text-zinc-500`** 이상.
- **데코 글리프**(`·` `›` `→` `▲▼` 등 zinc-300/400) → **`aria-hidden`** 처리 + 시각상 필요하면 `zinc-400`↑. 단순 장식은 대비 규정 대상 아님(정보 전달 아님).
- **어두운 표면 위 `zinc-400`** → **유지(SKIP)**. 라이트-온-다크라 이미 통과.
- ❗색상 단독 구분 금지(KRDS): 상태를 색으로만 표현하는 곳은 아이콘/텍스트 병행 확인(별도 점검).

## 3. SKIP 원장 (어두운 표면 — 유지, W DevTools 확인)

| 위치 | 근거 |
|------|------|
| `MoreMenuClient.tsx:96` `text-zinc-400` "나의 한 달 활동 이야기 보기" | 편지 카드 `bg-zinc-900`(다크) 위 → ≈6.3:1 통과 |
| `AdminSidebar` `text-slate-400` 전반 | 사이드바 `from-slate-900`(다크) 위 → 통과. (zinc-400 아님, 대상 밖) |

> 그 외 dark 표면 위 회색 텍스트는 W가 CSS Overview 로 추가 식별. **기본은 "라이트 → 교체".**

## 4. 대상 인벤토리 (기본 테마)

- 총 **170건**: `text-zinc-400` 159 + `text-zinc-300` 11. (재생성: `grep -rn "text-zinc-400\|text-zinc-300" src --include="*.tsx"`)
- **핫스팟(≥4건) — 우선 검토:**
  - `supporter/plans/[id]/PlanDetailClient.tsx` 14 · `supporter/budgets/[id]/page.tsx` 14
  - `admin/participants/[id]/ParticipantDetailClient.tsx` 9 · `receipt/ReceiptClient.tsx` 7(★당사자 주 플로우)
  - `admin/participants/new` 7 · `supporter/applications/new` 7 · `admin/participants/page` 7
  - `applications/[id]/ApplicationDetailClient` 6 · `[participantId]/report` 6
  - `network/NetworkGraphClient` 5(전부 `bg-white`/`zinc-50` — FIX) · `[participantId]/transactions` 5
  - `WaterCupPlanPreview` 4 · `review/ReviewQueueClient` 4 · `network/page` 4 · `map/MapClient` 4 · `assessment/AssessmentClient` 4 · `my-plan/MyPlanClient` 4
  - 나머지 ~30개 파일 1–3건.

### `text-zinc-300` 전량 (11건 — 가장 심각, 우선)
| 위치 | 성격 | 권장 |
|------|------|------|
| `map/PlaceSearch.tsx:123` `text-[10px]` 카테고리명 | 작은 텍스트 | zinc-500 |
| `help/HelpSlideshow.tsx:66` 슬라이드 번호 | 보조 텍스트 | zinc-500 |
| `supporter/page.tsx:20` 안내문 | 본문 | zinc-500/600 |
| `ui/FaqButton.tsx:59` ▲▼ | 데코 글리프 | aria-hidden(+zinc-400) |
| `admin/participants/page.tsx:80` 섹션 제목 | 제목(작음) | zinc-500 |
| `admin/page.tsx:41,47` 안내·섹션제목 | 본문/제목 | zinc-500 |
| `more/page.tsx:40` `·` · `:71` `›` | 데코 구분/셰브론 | aria-hidden(+필요시 zinc-400) |
| `more/page.tsx:78` `text-[10px]` 브랜드 캡션 | 작은 캡션 | zinc-500 |
| `MoreMenuClient.tsx:284` `→` (hover 시 진해짐) | 데코 화살표 | aria-hidden |

## 5. 우선순위

1. **당사자 주 플로우**: `receipt/ReceiptClient`, `(participant)/page`, `my-plan`, `calendar`, `gallery`, `more`.
2. **담당자 일상**: `transactions`(거래장부·검토), `plans`, `budgets`, `assessment`, `applications`.
3. **관리자**: `admin/*`, 상세 클라이언트(Plan/Participant/ApplicationDetail).
4. **공통 컴포넌트**: `ComingSoon`, `PlaceSearch`, `KakaoMap`, `WaterCupPlanPreview`, `NetworkGraphClient`.

## 6. 실행 방식 & 검증

- **일괄 sed 금지** — 맥락(라이트/다크·보조/본문) 판단이 필요. 파일별 검토 교체.
  (반자동: 다크 SKIP 원장을 제외한 파일에서 `text-zinc-400`→`text-zinc-500` 기본 치환 후, 본문급만 600 으로 승격하는 리뷰 패스.)
- **W 검증(W6)**: DevTools **CSS Overview → Contrast issues** + 실제 화면 병행. 샘플 화면: 홈 · 영수증 적기 · 거래장부 · 관리자 대시보드 · 관계망 · 더보기.
- **테마 회귀**: `html.dark-mode`·`high-contrast`·`yellow-bg` 는 `globals.css` 오버라이드 → 기본 토큰 교체가 세 테마에 미치는 영향 스팟 확인(대개 무관).
- **랜딩**: `feat/a3-contrast` PR — **#55(Phase A) 머지 후 그 위에서** 작업(파일 겹침: ReceiptClient·MoreMenuClient 등). W DevTools 사인오프 후 머지.

## 7. 비고
- 이 초안은 `feat/a3-contrast` 브랜치 문서. 실제 색 교체 커밋은 #55 머지 후 착수.
- 전체 원자료: 세션 scratchpad `a3-contrast-inventory.txt`(U 로컬) — 필요 시 위 grep 으로 재생성.
