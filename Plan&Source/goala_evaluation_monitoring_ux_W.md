# GOAL축 A · 평가(모니터링·정산) 화면 — UX·계약 설계 (W)

> 대상 구현: `src/app/(supporter)/supporter/evaluations/`(현재 4개 ComingSoon 스텁, 구 4+1/월간 IA — 전면
> 재설계) · `(participant)/evaluations/`(현재 "선생님의 편지" ComingSoon — 재구성, 신규 화면 아님).
> 백엔드: `monitoring.ts`·`settlement.ts` (전부 준비됨, **화면 없는 고아 액션**) + `seoul_monitoring_records`·
> `seoul_monitoring_usages`·`seoul_settlements`·`seoul_plan_reviews`(전부 준비됨).
> 계약: `src/utils/evaluationTimeline.test.ts` (test-first 골든) → **U 초록화**.
> 축 연속성: 사정→계획→예산→지출→**정산·평가(이 화면)** → (관계망 #51 이 전체를 그래프로 보여줌).

---

## 1. 이 화면은 무엇인가 (범위)

기존 `evaluations/[participantId]/[month]/`·`.../goals` 는 **복지부형 4+1 정형평가**(월별 점수표·목표관리)
IA를 그대로 옮겨온 껍데기다. `03_seoul_schema.sql` §11 주석이 명시하듯 **서울형에는 그런 정형평가가 없다.**
성과를 남기는 자리는 실질적으로 두 곳뿐이다:

- **모니터링**(`seoul_monitoring_records`) — 실무자가 방문·전화·앱·서류로 확인한 변화 기록. `observed_change`
  (실무자 관찰)와 `participant_voice`(당사자 본인의 말)를 **다른 칸**에 남긴다(스키마 주석 — 섞으면 누구
  말인지 사라진다). 개별 이용 건과 다대다 연결(`seoul_monitoring_usages`).
- **정산**(`seoul_settlements`) — 배정 대비 승인·거절·환수·미사용 금액. `unused_amount`는 **실패가 아니다**
  (스키마 주석) — "쓸 곳을 못 찾아서"인지 "필요가 없어서"인지는 모니터링 기록과 **나란히** 읽어야 판단할 수
  있다. 정산 화면이 숫자만 보여주고 모니터링과 떼어놓으면 이 원칙이 깨진다.

여기에 **심의 이력**(`seoul_plan_reviews` — 이미 `review/`에서 결정 자체는 처리됨)을 **읽기 참조**로 곁들여
"왜 이 배정이 이렇게 됐는가"의 맥락을 잇는다(신규 심의 액션 아님, 이미 있는 결정 열람만).

**이 화면이 하지 않는 것**: 4+1 점수표·월별 목표(`goals`) 재현 — 서울형에 실체가 없으므로 **삭제**(§6).
계획 편집은 `plans/[id]`, 지출 기록은 `transactions/new`, 심의 결정 자체는 `review/`가 정본.

### 라우트 재설계
- `evaluations/[participantId]/` (당사자 1인 통합 뷰) — **참여자 그레인**. 기존 `[month]` 드릴다운·`goals`
  서브라우트는 **폐기**(§6 근거). `budgets/[id]` 의 "정산 보기" 링크(현재 `/supporter/evaluations` 고정,
  참여자 미지정 — 고아 링크)를 `/supporter/evaluations/${participantId}` 로 U 가 고친다(§8).
- `evaluations/` (목록) — `participants/page.tsx` 와 같은 패턴으로 당사자 목록 → 각 행에서 상세로.

---

## 2. 데이터 매핑

| 화면 요소 | 출처 | 그레인·주의 |
|---|---|---|
| 모니터링 타임라인 | `seoul_monitoring_records`(participant_id) + `seoul_monitoring_usages`→`seoul_service_usages` | 참여자 그레인. `monitoring_date` 내림차순. |
| 실무자 관찰 / 당사자 말 | `observed_change` / `participant_voice` | **절대 한 칸에 합치지 말 것**(스키마 원칙) — 화면도 두 라벨 유지. |
| 확인한 이용 건 | `seoul_monitoring_usages` → `service_usages`(금액·날짜·영역) | 모니터링 1건이 여러 지출을 참조할 수 있음(다대다). |
| 정산 카드 | `seoul_settlements`(allocation_id, settled_period) | `UNIQUE(allocation_id, settled_period)` — 배정×기간 그레인. |
| 미사용 해석 | `unused_amount` + 같은 기간 모니터링 노트 | 정산 카드 옆에 관련 모니터링 발췌를 붙여 "왜 안 썼는지" 맥락 제공(§7 `unusedContext`). |
| 심의 이력(읽기) | `seoul_plan_reviews`(plan_id) | `decision`·`reason`·`review_date`. 결정 변경 UI 없음(정본은 `review/`). |
| 진입 배정 | `seoul_budget_allocations`(participant 최신 또는 `budgets/[id]`에서 전달) | `plan_id`→`seoul_utilization_plans`→participant. |

### id 조인 원칙 (§8-4/§8-5 연속)
- 전부 **UUID FK**로 연결(`participant_id`·`allocation_id`·`plan_id`) — 라벨 조인 금지 원칙 계승.
- `monitoring_records.allocation_id`는 **nullable**(스키마) — 배정 이전에도 모니터링 가능(예: 선정 직후
  적응 확인). 배정 없는 모니터링은 타임라인에 "배정 전 기록"으로 표시, 정산 카드와 섞지 않는다.

---

## 3. 정보구조 (IA) — 담당자 화면 (`evaluations/[participantId]`)

```
[헤더]  ← 뒤로   |  {이름}님의 정산·평가
────────────────────────────────
① 정산 카드 (기간별, 최신 먼저)
   {기간}  받은 돈 ₩{accepted} · 못 받은 돈 ₩{rejected} · 환수 ₩{recovered}
   미사용 ₩{unused}  [미사용 이유 배지: 이유 있음/확인 필요]
   └ 관련 모니터링 발췌(있으면): "{observed_change 요약}"
────────────────────────────────
② 모니터링 타임라인 (최신 먼저)
   {날짜} · {방법 아이콘: 방문/전화/앱/서류}
   실무자 관찰: {observed_change}
   당사자 말:  {participant_voice}
   확인한 지출: {usage 배지 n건}
   [+ 새 모니터링 기록] ← recordMonitoring 폼(§5)
────────────────────────────────
③ 심의 이력 (읽기전용, 접어두기)
   {날짜} {승인/조건부/반려}  사유: {reason}
────────────────────────────────
[길목] 예산 보기 → budgets/[id] · 지출 기록 → transactions/new
```

빈 상태: 모니터링 0건 — "아직 확인한 기록이 없어요. 처음 방문·통화 후 기록해 보세요." + 기록 버튼 강조.

## 3b. 당사자 화면 (`(participant)/evaluations`, 기존 "선생님의 편지" 컨셉 유지)

당사자에게 "정산·모니터링"이라는 행정 언어를 그대로 노출하지 않는다. 기존 스텁이 잡아둔 은유
**"선생님의 편지"** 를 그대로 살려 모니터링 기록을 **담당자가 남긴 편지**처럼 보여준다(재설계 아님, 프레이밍
계승).

```
💌 선생님이 남긴 기록
────────────────────
{날짜}
"{observed_change 를 쉬운 말로}"     ← 실무자 관찰(당사자용 순화, §5)
내가 한 말: "{participant_voice}"     ← 원문 그대로(당사자 자신의 말은 순화하지 않음)
────────────────────
남긴 돈은 어떻게 됐나요?
{기간}: 다 못 쓴 돈이 있어요 — "괜찮아요, 실패가 아니에요"
```

- **모니터링**: 당사자는 **읽기만**(기록 작성은 실무자 전용, RLS 그룹 A — `assertStaff`). 원문 그대로 노출은
  개인정보 우려가 없다(본인 데이터, RLS 로 자기 것만).
- **정산 미사용**: `describeCopay` 와 같은 원칙 — "미사용=실패"로 읽히지 않게 **긍정 프레이밍 고정 문구**
  사용(§5). 금액 배지보다 "왜 남았는지" 맥락 문장이 먼저.

---

## 4. easy-read 카피 (당사자 노출분, `validate_easy_read` 대상)

| 위치 | 카피 |
|---|---|
| 화면 제목 | `선생님이 남긴 기록` |
| 모니터링 방법 | `만났어요` / `전화했어요` / `앱으로 봤어요` / `서류로 봤어요` (visit/phone/app/document) |
| 정산 안내(제목) | `쓴 돈은 어떻게 됐나요` |
| 미사용 고정 문구 | `아직 다 안 쓴 돈이 있어요. 괜찮아요, 잘못한 게 아니에요.` (실패 프레이밍 금지 — copay §5 원칙 계승) |
| 빈 상태 | `아직 남긴 기록이 없어요. 선생님을 만나면 여기에 나와요.` |

담당자 화면은 표준어(`관찰 기록`·`정산`·`미사용액`·`심의 사유`) 그대로 사용 가능.

---

## 5. 담당자 입력 폼 — `recordMonitoring` 계약 확인 (신규 백엔드 없음)

`src/app/actions/monitoring.ts`의 `recordMonitoring(input: MonitoringInput)`을 **그대로 소비**한다(신규
서버액션 불필요 — 이미 완결·RLS 확인됨). 폼 필드: `method`(4지선다 아이콘 버튼) · `observedChange`(textarea) ·
`participantVoice`(textarea, 별도 칸 강제) · `allocationId`(선택, 화면 컨텍스트에서 자동 주입).

`getMonitoringRecords`/`getSettlements` 는 이미 참여자 스코프 파라미터를 받으므로 화면은 **그대로 호출**만
하면 된다 — U 구현은 표시·폼 배선 위주, 새 쿼리 설계 불필요.

---

## 6. 폐기 근거 — `[month]`·`goals` 서브라우트

- `evaluations/[participantId]/[month]/plans` (월별 계획 편집): 서울형 계획 편집의 정본은
  `plans/[id]`(완성) 하나뿐 — 월 단위로 계획을 쪼개는 개념이 seoul 스키마에 없음(`seoul_utilization_plans`는
  기간 통짜: `plan_period_start`~`plan_period_end`).
- `evaluations/[participantId]/goals` (목표 관리): seoul 스키마에 대응 테이블 없음(레거시 `support_goals`는
  구 PCP 모델). "시도하고 싶은 것"은 이미 `seoul_self_narratives.goal_to_try`로 계획 화면에 통합돼 있다
  (`plans/[id]` §7-§서식 5항목). 별도 목표 화면을 만들면 같은 데이터가 두 곳에서 따로 편집되는 이중관리가
  생긴다.
- → U 는 이 두 라우트 디렉터리를 **삭제**하고 `evaluations/[participantId]/page.tsx` 하나로 통합한다.
  (기존 링크가 있다면 함께 정리 — grep 결과 이 두 라우트로의 내부 링크는 없음, 고아 스텁이었음.)

---

## 7. test-first golden 계약 — `evaluationTimeline.ts`

`domainAxisReport.ts`/`budgetByDomain.ts`의 형제. 모니터링·정산·심의 3종 원시 행을 **참여자(또는 배정)
그레인의 정렬된 타임라인**으로 합치는 순수 함수. `src/utils/evaluationTimeline.ts`에 U 가 구현, 골든
`src/utils/evaluationTimeline.test.ts`(W 작성, RED→U green).

```ts
// 시그니처 (U 구현 대상) — src/utils/evaluationTimeline.ts

export interface MonitoringRow {
  id: string; monitoringDate: string; method: string | null
  observedChange: string | null; participantVoice: string | null
  allocationId: string | null
}
export interface SettlementRow {
  id: string; allocationId: string; settledPeriod: string
  acceptedAmount: number; rejectedAmount: number; recoveredAmount: number; unusedAmount: number
}
export interface PlanReviewRow {
  id: string; decision: 'approved' | 'conditional' | 'rejected'; reason: string | null; reviewDate: string
}

export type TimelineEntryKind = 'monitoring' | 'settlement' | 'review'
export interface TimelineEntry {
  kind: TimelineEntryKind
  date: string        // ISO — 정렬 키
  id: string
  // kind 별 원본 행 그대로 보존(화면이 필요한 만큼 골라 씀)
  monitoring?: MonitoringRow
  settlement?: SettlementRow
  review?: PlanReviewRow
}

/** 3종을 날짜 내림차순 병합. 같은 날짜는 monitoring > settlement > review 순(불변식 4). */
export function buildEvaluationTimeline(
  monitoring: MonitoringRow[], settlements: SettlementRow[], reviews: PlanReviewRow[]
): TimelineEntry[]

/**
 * 정산 미사용 해석 — 같은 배정의 모니터링 기록 중 settledPeriod 범위와 겹치는
 * observedChange 발췌를 찾아 "왜 남았는지" 맥락을 붙인다. 없으면 undefined(화면은
 * "확인 필요" 배지, 있으면 그 발췌를 인용).
 */
export function unusedContext(
  settlement: SettlementRow, monitoring: MonitoringRow[]
): string | undefined
```

### 골든이 못박는 불변식
1. **분리 원칙**: `observedChange`/`participantVoice`는 병합·요약 과정에서 **절대 합쳐지지 않는다**(별도
   필드 유지) — 스키마 §11 주석의 화면판.
2. **정렬**: `date` 내림차순(최신 먼저), 날짜 문자열 비교가 아니라 `Date` 파싱 기준.
3. **동일 날짜 tie-break**: `monitoring > settlement > review` 순(위 예시). 임의 순서 금지 — 재현성.
4. **배정 없는 모니터링**: `allocationId: null`인 행도 타임라인에 포함(배정 전 기록) — 누락 금지, 단
   `unusedContext`의 대상은 아님(정산과 연결 불가하므로 자연히 매칭 안 됨).
5. **`unusedContext`**: `unused_amount<=0`이면 항상 `undefined`(맥락 자체가 불필요) — "0원인데 확인 필요
   배지"가 뜨지 않게.
6. **빈 입력**: 세 배열 모두 빈 배열 → 빈 배열 반환(널 아님).

→ 이 골든이 RED 인 동안 U 가 `buildEvaluationTimeline`/`unusedContext` 구현해 green. 이후 화면(§3)이 이
함수를 소비.

---

## 8. 구현 노트 (U-lane)

- **재사용**: `recordMonitoring`/`getMonitoringRecords`(monitoring.ts) · `recordSettlement`/`getSettlements`
  (settlement.ts) 그대로. `seoul_plan_reviews` 조회는 신규 read 헬퍼 1개만 필요(`planReview.ts`에 이미
  `decidePlanReview`가 있으니 같은 파일에 `getPlanReviews(planId)` 추가 — RLS 는 기존 정책 재사용, 신규
  정책 불필요).
- **컴포넌트**: `evaluations/page.tsx`(목록, `participants/page.tsx` 패턴 재사용) →
  `evaluations/[participantId]/page.tsx`(서버: monitoring·settlements·reviews 로드 → `buildEvaluationTimeline`)
  → `EvaluationClient.tsx`(타임라인 렌더 + 모니터링 입력 폼, §5).
- **당사자 미러**: `(participant)/evaluations/page.tsx` 기존 파일 교체(§3b) — `getMonitoringRecords()`를
  인자 없이 호출하면 RLS 가 본인 것만 반환(기존 함수 시그니처 그대로 재사용, 신규 파라미터 불필요).
- **진입점 수정(필수)**: `budgets/[id]/page.tsx:338`의 `href="/supporter/evaluations"` →
  `` href={`/supporter/evaluations/${participantId}`} ``로 고친다(현재 참여자 미지정 고아 링크).
- **라우트 정리**: `evaluations/[participantId]/[month]/`·`evaluations/[participantId]/goals/` 디렉터리
  삭제(§6). 남기는 파일: `evaluations/page.tsx`(재작성) · `evaluations/[participantId]/page.tsx`(신설).
- **easy-read**: 당사자 노출 신규 문구는 `validate_easy_read`로 실측 후 반영(§4 표는 초안 — pass 확인은 U
  구현 시 W 리뷰에서 재검증).

---

## 부록. 열린 질문(사용자·기관 확인 필요 시)
- 모니터링 기록 **수정/삭제** UI 필요한가? (현재 `monitoring.ts`에 insert만 있음 — 이번 스코프는 열람+신규
  기록만. 수정 필요 시 별도 W 계약.)
- 정산 화면에서 **금액 직접 입력 폼**을 이번에 포함할지, 관리자 전용이라 우선순위를 낮출지(정산은
  `assertAdmin` — 실무자 화면과 권한이 다름). 권장: 담당자 열람+모니터링 입력 먼저 green → 관리자 정산 입력
  폼은 후속(admin 레인, `admin/settlements` 신설 후보).
