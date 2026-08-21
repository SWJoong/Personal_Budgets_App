# GOAL축 A · 예산(이용계획) 화면 — UX·easy-read 설계 (W)

> 대상 구현: `src/app/(supporter)/supporter/budgets/[id]/` (현재 7줄 ComingSoon stub, **진입점 없음**).
> 백엔드: `utilizationPlan.ts`·`planReview.ts`·`serviceUsage.ts` + `seoul_budget_allocations` (전부 준비됨).
> 계약: `src/utils/budgetByDomain.test.ts` (test-first 골든, §8-5 그레인 잠금) → **U 초록화**.
> 축 연속성: 사정(GOAL축B `domainAxisReport`) → **예산(이 화면)** → 지출(#39) 을 같은 domain_id 축으로 잇는다.

---

## 1. 이 화면은 무엇인가 (범위)

예산 화면은 **"돈" 뷰**다. 계획이 심의를 통과하면(`decidePlanReview` 승인/조건부) `seoul_budget_allocations`
행이 자동 생성된다(차수 한도 상속, copay 트리거). 이 화면은 그 배정을 **읽고 모니터링**한다:

- 얼마 배정됐나 (봉투) · 얼마 썼나 · 얼마 남았나
- 영역별로 **계획 대비 집행**이 어떤가 (사정→계획→집행 3축)
- 계획에 없던 지출(검토 대상)이 어디 있나

**작성·편집은 이 화면이 아니다.** 계획 내용(자기서술·요청서비스) 편집은 `plans/[id]`(이미 완성),
지출 기록은 `transactions/new`(#39 완성), 심의는 `reviews`. 예산 화면은 **읽기 우선 대시보드** +
그 화면들로 가는 **길목**이다. (easy-read 에 유리 — 입력 부담이 낮다.)

### 라우트 파라미터
`[id]` = **배정 id**(`seoul_budget_allocations.id`) 권장. 배정은 `UNIQUE(plan_id)` 라 봉투 1개 = 화면 1개로
안정적. 진입점(§4)은 당사자 상세에서 그 사람의 **현재 배정**을 찾아 링크한다. (U 가 participantId 키로 바꾸고
싶으면 화면 내용은 동일 — 최신 배정 1행을 해석해 쓰면 됨.)

---

## 2. 데이터 매핑 + §8-5 그레인 (설계의 핵심 — 어기면 손실집계)

| 화면 요소 | 출처 | 그레인·주의 |
|---|---|---|
| 봉투: 총 배정액 | `budget_allocations.allocated_amount` | 플랜당 1행. 봉투는 **영역으로 쪼개지 않는다**. |
| 봉투: 총/월 한도·기간 | `total_ceiling`·`monthly_ceiling`·`starts_on`~`ends_on`·`period_months` | |
| 봉투: 본인부담금 | `copay_amount`·`copay_status` | `unverified` 는 "확인 전" 경고로 표시(스키마 규칙). |
| 봉투: 이월 | `carry_over_allowed` | |
| 봉투: 쓴 돈 / 남은 돈 | Σ`service_usages.amount` / `allocated_amount − Σamount` | 봉투 레벨 잔액. |
| **영역별 계획 금액** | Σ`requested_services.estimated_cost` **GROUP BY `requested_services.domain_id`** | ★§8-5: **requested_services 그레인**. |
| **영역별 집행 금액** | `v_seoul_domain_flow`(금액·건수·계획외_금액) | `service_usages.domain_id` 그레인. |
| 영역별 남음/초과 | 영역 계획 − 영역 집행 | 영역 레벨. |
| 계획외 지출 | `v_seoul_domain_flow.계획외_금액` (= `requested_service_id IS NULL`) | "검토 대상", 자동 거절 아님. |
| 요청서비스 목록 | `requested_services`(priority·service_name·domain·estimated_cost·approved_for_service·review_note) | 계획 그레인 원천. 읽기전용(편집=plans/[id]). |

### ★ §8-5 금지사항 (절대)
- **`budget_allocations.domain_id` 에 UI 를 얹지 말 것** — `UNIQUE(plan_id)` 라 플랜당 1행인데 플랜은
  다-domain → 영역별로 쓰면 **손실집계**. 영역별 계획은 반드시 `requested_services.domain_id` 그레인.
- 계획·집행 조인은 **domain_id 로만**(라벨 조인 금지, §8-4). 라벨은 program(seoul·mohw) 스코프라 충돌.
- 봉투(allocated_amount)는 플랜 레벨 1회 표시 — 영역 합계와 억지로 일치시키지 말 것(계획합계≠배정액 정상:
  배정은 차수 한도, 계획은 신청 추정).

---

## 3. 정보구조 (IA) — 모바일 우선, 위→아래

```
[헤더]  ← 뒤로   |  {이름}님의 예산
────────────────────────────────
① 예산 봉투 카드 (가장 크게)
   ┌ 남은 돈  ₩{remaining}  ← 헤드라인(가장 큰 숫자)
   │ 쓴 돈 ₩{used} / 배정 ₩{allocated}   [진행 막대]
   │ 기간 {start}~{end} · 월 한도 ₩{monthly}
   │ 본인부담금 ₩{copay}  [상태 배지]  (unverified=확인 전 경고)
   └ 이월 {가능/불가}
────────────────────────────────
② 영역별 예산 흐름 (6영역 스파인, 순서 고정)
   영역 | 계획 ₩ | 쓴 돈 ₩ | 남음/초과 | [신호 배지]
   … 계획외 지출이 있으면 그 영역 행에 표시
────────────────────────────────
③ 계획에 없던 지출 (있을 때만 노랑 콜아웃)
   "계획에 없던 지출 {n}건 ₩{sum} — 검토가 필요해요"  [검토로 가기]
────────────────────────────────
④ 요청한 서비스 (읽기전용 목록)
   우선순위·이름·영역·계획금액·[승인 배지]·(심의 메모=담당자만)
   [계획 수정하기 → plans/[id]]
────────────────────────────────
[길목 버튼]  지출 기록하기 → transactions/new
             정산·평가 보기 → evaluations
```

배정이 아직 없을 때(계획 미승인) = **빈 상태**(§5): "아직 예산이 정해지지 않았어요" + 계획/심의로 안내.

---

## 4. 흐름 (생명주기 안에서의 위치)

```
신청(선정) → 계획작성(plans) → 제출 → 심의(reviews)
                                         │ 승인/조건부
                                         ▼
                               ★예산 배정 자동생성  ──▶  [예산 화면(이 설계)]
                                         │                    │ 길목
                                         ▼                    ▼
                                   통지→확인            지출기록(transactions) → 정산·평가(evaluations)
```

- **진입점(신설 필요, U-lane)**: `당사자 상세(supporter/participants/[id])` 에 "예산 보기" 버튼 →
  그 사람 최신 배정으로. (현재 budgets 링크 0개 = 고아 stub.) 대시보드 카드에서도 진입 가능.
- 예산 화면은 **막다른 길이 아니라 길목** — 지출/계획/정산으로 분기.

---

## 5. 화면별 easy-read 카피 (쉬운 말)

> 원칙: 한 문장 한 뜻 · 짧게 · 쉬운 낱말 · 숫자는 "원" 붙여 또렷이 · 능동태 · 부정보다 긍정.
> 아래 당사자-노출 문구는 `validate_easy_read` 로 검증함(§7 결과 반영).

### 헤딩·라벨
| 위치 | 카피 |
|---|---|
| 화면 제목 | `{이름}님의 예산` |
| ① 봉투 헤드라인 | `남은 돈` |
| ① 보조 | `쓴 돈` · `배정된 돈` · `한 달 한도` · `쓸 수 있는 기간` |
| ① 본인부담금 | `내가 낼 돈` (전문어 "본인부담금" 대신) · 배지 `확인 전`/`면제`/`부과` |
| ② 섹션 | `영역별로 보기` |
| ② 열 | `영역` · `계획한 돈` · `쓴 돈` · `남은 돈` |
| ③ 콜아웃 | `계획에 없던 지출이 있어요` |
| ④ 섹션 | `받기로 한 서비스` |
| ④ 편집 링크 | `계획 고치기` |
| 길목 | `지출 적기` · `정산 보기` |

### 상태 배지(영역 신호) — `budgetStatus`/`budgetStatusLabel` (계획 vs 집행 기반, §7)
| 상태 | 당사자용 쉬운 말 | 담당자용(툴팁) |
|---|---|---|
| ok | `쓰는 중이에요` | 계획 있고 집행 계획 내 |
| unused | `아직 안 썼어요` | 계획 있음, 집행 0 |
| over | `계획보다 많이 썼어요` | 영역 집행>계획 |
| unplanned | `계획에 없던 지출` | 계획 0, 집행 있음 |
| none | `해당 없음` | 계획·집행 모두 0 |

### 빈 상태·안내 문장 (당사자 노출 대상 — `validate_easy_read` **pass** 실측)
- 예산 미배정: `아직 예산이 정해지지 않았어요. 계획이 정해지면 여기에 보여요.`
- 계획외 지출 콜아웃(당사자): `계획에 없이 쓴 돈이 {n}번 있어요. 담당 선생님이 살펴볼 거예요.`
  (※ "검토 대상/반려/확인" 같은 위협·어려운 어휘 회피 — "지출→쓴 돈", "확인→살펴봄". 거절이 아님을 명확히.)
- 본인부담금 확인 전(당사자): `내가 낼 돈은 아직 정해지지 않았어요.`
  (※ 3문장 모두 errors 0·warnings 0. 담당자 화면은 "계획외 지출"·"본인부담금 확인 전" 등 표준어 사용 가능.)

---

## 6. 당사자 노출범위 (무엇을 보여주고 무엇을 감추나)

이 화면 자체는 `(supporter)` 그룹 = **담당자·관리자 전용**. 당사자용은 `(participant)` 미러(별도, 후속)로
같은 데이터의 **부분집합**을 쉬운 말로. 아래는 그 미러 설계 원칙.

| 데이터 | 당사자 | 담당자 | 이유 |
|---|---|---|---|
| 남은 돈·쓴 돈·배정액 | ✅ 크게 | ✅ | 당사자의 알 권리 핵심. |
| 영역별 계획/쓴 돈/남음 | ✅ 쉬운 말 | ✅ | 자기 예산 이해. |
| 계획외 지출 | ✅ "선생님이 확인 중" | ✅ 검토 링크 | 불안 주지 않게(거절 아님). |
| 본인부담금 상태 | ✅ "확인 중"만 부드럽게 | ✅ 전체 상태 | `unverified` 를 위협적으로 노출 금지. |
| 심의 메모(`review_note`) | ❌ | ✅ | 담당자 내부 판단. |
| `approved_for_service` 내부 플래그 | ❌(결과만 쉬운 말) | ✅ 배지 | 행정 플래그. |
| 차수·한도 원리·이월 규칙 | ❌ | ✅ | 제도 메커니즘. |

RLS 는 이미 당사자를 `seoul_can_access` 로 자기 데이터에 한정 → 미러 화면은 **표시 선택**의 문제지 권한
확장이 아니다.

---

## 7. test-first 골든 계약 — `buildBudgetByDomain` (§8-5 잠금)

`domainAxisReport.ts`(사정→지출 2축)의 형제. **계획(requested_services 그레인)** 축을 추가한 순수 함수.
`src/utils/budgetByDomain.ts` 에 U 가 구현, 골든 `src/utils/budgetByDomain.test.ts`(W 작성, RED→U green).

예산 신호는 사정(needs)이 아니라 **계획 vs 집행**의 함수다 → `axisStatus`(needs 기반)를 재사용하지 말고
별도 `budgetStatus(plannedSum, usageSum)` 를 둔다.

```ts
// 시그니처 (U 구현 대상) — src/utils/budgetByDomain.ts
import type { DomainSpine, DomainFlowRow } from './domainAxisReport' // 재사용

export interface PlannedServiceRow { domain_id: string | null; estimated_cost: number | null }
export type BudgetStatus = 'ok' | 'over' | 'unused' | 'unplanned' | 'none'
export interface BudgetDomainRow {
  domainId: string; label: string
  plannedSum: number   // Σ estimated_cost by domain (requested_services 그레인, §8-5)
  usageSum: number     // v_seoul_domain_flow 금액
  remaining: number    // plannedSum − usageSum (영역 레벨)
  unplannedSum: number // 계획외
  status: BudgetStatus
}

// 계획 vs 집행 판정 (음수 집행은 0 취급, 경계 usage==planned 는 ok)
//   planned>0 & 0<usage<=planned → ok / usage>planned → over / usage<=0 → unused
//   planned<=0 & usage>0 → unplanned / 둘다<=0 → none
export function budgetStatus(plannedSum: number, usageSum: number): BudgetStatus
export function budgetStatusLabel(status: BudgetStatus): string // 쉬운 말(§5 배지)
export function buildBudgetByDomain(
  domains: DomainSpine[], planned: PlannedServiceRow[], flow: DomainFlowRow[]
): BudgetDomainRow[]
```

배지 쉬운 말: `ok→쓰는 중이에요` · `over→계획보다 많이 썼어요` · `unused→아직 안 썼어요` ·
`unplanned→계획에 없던 지출` · `none→해당 없음`.

### 골든이 못박는 불변식
1. **§8-5 그레인**: 같은 domain_id 의 requested_services **2행이 합산**된다(플랜당 1행 배정으로 착각 금지).
2. **id 조인(§8-4)**: 계획·집행 모두 domain_id 로 만난다 — 라벨 충돌(seoul/mohw 동명)로 섞이지 않음.
3. **초과**: 집행>계획 → `remaining<0` + `status='over'`.
4. **계획외**: 계획 0·집행>0 인 영역 → `unplanned`, `unplannedSum` 반영.
5. **스파인 순서·6영역 전부** 유지(집계 0 인 영역도 행 존재).
6. `domain_id=null` 인 계획/집행 행은 **어떤 영역에도 안 붙는다**(미분류 별도).

→ 이 골든이 RED 인 동안 U 가 `buildBudgetByDomain` 구현해 green. 이후 화면(③②)이 이 함수를 소비.

---

## 8. 구현 노트 (U-lane)

- **재사용**: `axisStatus`/`axisStatusLabel`/`DomainSpine`/`DomainFlowRow` 그대로. `v_seoul_domain_flow`
  (이미 domain_id emit) 그대로. 새 뷰 불필요 — 계획합계는 `requested_services` 를 서버컴포넌트에서
  domain_id 로 group(또는 JS 집계) 후 `buildBudgetByDomain` 에 전달.
- **컴포넌트**: `budgets/[id]/page.tsx`(서버: allocation·requested_services·v_seoul_domain_flow·needs 로드,
  signed URL 불필요) → `BudgetDetailClient.tsx`(표시 위주, 상호작용 최소 — 링크·펼치기 정도).
- **진입점(신규)**: `participants/[id]` 에 "예산 보기" 링크 + 최신 배정 해석. budgets 고아 해소.
- **easy-read**: 금액은 `toLocaleString('ko-KR')` + "원". 진행 막대 색은 테마 토큰(WCAG AA). 터치 44px.
- **당사자 미러**(후속 PR): `(participant)` 에 읽기전용 부분집합(§6). 이번 스코프 아님.
- **정합 주의**: 봉투 잔액(allocated−Σusage)과 영역별 남음 합계는 **다를 수 있다**(계획합계≠배정액). 두 수를
  억지로 맞추지 말고 각각 정직하게 표시.

---

## 부록. 열린 질문(사용자·기관 확인 필요 시)
- 배정액 **수기 조정** UI 필요한가? (현재 백엔드에 update 액션 없음 → 이번 스코프 제외, 필요 시 W 계약 후 U.)
- 당사자 미러를 이번 마일스톤에 포함? (권장: 담당자 화면 먼저 green → 미러 후속.)
