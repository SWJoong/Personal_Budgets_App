# 예산 실행 통합 뷰 (#4) — 설계·계약 (W)

> 관리자 QA #4: "예산 편성→심의 통과→계획 대비 실제 사용→사용내역(자부담 점검) 프로세스가
> 한 눈에. 건·일·주·월 확인." 사용자 결정: **통합 실행 뷰(신규 페이지)**. 조각 데이터는 대부분
> 존재 — 신규 페이지에서 한 화면으로 묶고, 사용내역에 건/일/주/월 시간버킷 토글을 붙인다.

## 데이터 소스 (기존, 무변경 재사용)
- `v_seoul_budget_balance`(참여자별): `allocated_amount`(승인=편성)·`spent`·`remaining`·`total_ceiling`·`monthly_ceiling`·`copay_amount`·`copay_status`·`usage_count`·`unplanned_count`.
- `v_seoul_domain_flow`(영역별): `영역`·`건수`·`금액`(실제)·`계획외_건수`·`계획외_금액`.
- `seoul_service_usages`: `usage_date`(DATE)·`amount`·`description`·`settlement_status`·`domain_id` — **시간버킷 원천**.
- `seoul_requested_services`(계획 그레인)·`seoul_service_domains`(영역 라벨).
- `seoul_benefit_status`: 자부담 상태.

## ① 시간버킷 util — `src/utils/usageBuckets.ts` (U) ★핵심 로직·계약
```ts
export type BucketMode = 'item' | 'day' | 'week' | 'month'
export interface UsageForBucket { id: string; usage_date: string; amount: number; description?: string | null; settlement_status?: string | null; domainLabel?: string | null }
export interface UsageBucket { key: string; label: string; count: number; total: number; items: UsageForBucket[] }
export function bucketUsages(usages: UsageForBucket[], mode: BucketMode): UsageBucket[]
```
- `item`(건별): usage 1건 = 버킷 1(key=id). `day`: `usage_date`(YYYY-MM-DD)로 묶음. `month`: `YYYY-MM` 접두. `week`: ISO 주(월요일 시작) — key=그 주 월요일의 YYYY-MM-DD.
- 각 버킷: `count`·`total`(amount 합)·`items`. 버킷은 key 내림차순(최신 먼저). 빈 입력→[].
- 불변식(계약): **모든 모드에서 Σ버킷.total = Σusage.amount**(금액 보존)·item 버킷수=usage수·같은 달/일은 한 버킷·주 버킷수 ≤ 일 버킷수 且 ≥ 월 버킷수.

### 계약 `src/utils/usageBuckets.test.ts` (W, golden) — RED
month/day/item 정확 그룹핑·금액 보존(4모드)·주 coarseness. (계산 결정성 위해 주는 정확 날짜 대신 불변식으로 못박음.)

## ② 페이지 — `src/app/(supporter)/supporter/[participantId]/budget-execution/page.tsx` (U, 서버)
requireStaff → 병렬 로드(balance·domain_flow·usages·이름) → `<BudgetExecutionClient .../>`. `metadata={title:'예산 실행'}`. 표준 `<main id="main-content">`·뒤로가기.

## ③ 클라이언트 — `BudgetExecutionClient.tsx` (U)
한 화면 4구획:
- **①편성/심의**: 승인금액(allocated)·(있으면 total/monthly ceiling)·심의 통과(배정 존재)·자부담 상태(copay_status).
- **②계획 대비 실제**: 전체 allocated vs spent(진행바)·remaining. 영역별(domain_flow): 영역·실제금액·**계획 밖(계획외_금액)** 강조. `MoneyText`·`formatCurrency`.
- **③사용 내역 (시간버킷)**: **건/일/주/월 토글**(4버튼) → `bucketUsages(usages, mode)` 로 그룹 렌더(버킷 라벨·건수·합계·펼치면 항목). 상태칩(settlementLabel).
- **④자부담 점검**: copay_amount·copay_status(면제/부과/미검증) — "자부담비 사용분" 안내.
Easy Read·44px·시맨틱 토큰·비색큐·light/dark.

## ④ 허브 배선 (U)
`participants/[id]/page.tsx` 에 "예산 실행"(💳 `/supporter/[id]/budget-execution`, desc '계획·실제·자부담') 카드 추가. (budgets/[id]·report 와 중복 아님 — 저건 계획/사정 뷰, 이건 집행·시간축.)

## 게이트
재게이트: tsc·lint·vitest(usageBuckets golden)·build + 라이브 QA(4구획·건/일/주/월 토글 실제 그룹 변화·금액 일치). 순수 프론트(DB 슬라이스 아님·Manual-Ops 없음).
