# 평가(모니터링·정산·심의) 통합 화면 — 설계 (W)

> 레인: **W 설계·검증**. 골든 계약 = [`src/utils/evaluationTimeline.test.ts`](../src/utils/evaluationTimeline.test.ts) (test-first RED).
> 구현(순수 함수·화면·라우트 정리)은 **U 레인**. 이 문서는 스펙이고, 초록화는 U.

## 1. 배경 — 왜 다시 짜는가

서울형에는 **4+1 같은 정형 평가가 없다**(`supabase/seoul/03_seoul_schema.sql` §11 주석). 성과평가에
쓸 "변화의 근거"는 세 곳에 흩어져 기록된다:

| 소스 | 테이블 | 무엇 | 날짜 컬럼 |
|------|--------|------|-----------|
| 모니터링 | `seoul_monitoring_records` | 실무자 관찰(`observed_change`) + 당사자 본인의 말(`participant_voice`) | `monitoring_date` |
| 정산 | `seoul_settlements` | 인정·미사용액. **미사용은 실패가 아니다** | `settled_on` (기간 `settled_period`) |
| 심의 | `seoul_plan_reviews` | 승인/조건부/부결 + 사유 | `review_date` |

**현재 상태 = 공백**:
- `monitoring.ts` · `settlement.ts` · `planReview.ts` 액션은 **이미 완결**인데 **소비 화면이 없다**(고아 액션).
- `(supporter)/evaluations/**` 는 전부 `ComingSoon` 플레이스홀더. `[participantId]/[month]` · `goals` · `[month]/plans`
  는 서울형에 대응 테이블이 없는 **4+1 레거시 IA** — 폐기 대상.
- `(participant)/evaluations` 는 `ComingSoon "선생님의 편지" 💌` — 프레이밍은 좋다, 내용이 비었을 뿐.
- `budgets/[id]:338` "📋 정산 보기" 링크가 참여자 미지정 `/supporter/evaluations`(제네릭)로 샌다(고아 링크).

## 2. 설계 원칙 (계약이 강제하는 것)

1. **하나의 시간축**. 세 소스를 참여자 단위로 **날짜 내림차순** 타임라인으로 접는다. 월(month) 축으로
   쪼개지 않는다(레거시 `[month]` 라우트를 폐기하는 이유).
2. **tie-break = monitoring > settlement > review**. 같은 날짜면 관찰이 먼저 읽혀야 정산·심의가 해석된다.
3. **결정성**. 같은 날짜·같은 종류는 입력 순서 보존(안정 정렬) — 렌더가 흔들리지 않는다.
4. **배정 없는 모니터링도 포함**. `allocation_id` 가 없다고 걸러내지 않는다(배정 전 관찰도 성과의 일부).
5. **★분리 불변식**. `observedChange`(실무자)와 `participantVoice`(당사자)는 끝까지 **다른 필드**.
   한쪽이 없으면 `null` 그대로 — 상대 값으로 지어내지 않는다. 누구 말인지 사라지면 안 된다.
6. **미사용액 = 맥락과 함께**. `unused_amount` 는 "쓸 곳을 못 찾아서"인지 "필요가 없어서"인지 다르다.
   같은 **기간(settled_period)의 모니터링**과 나란히 보여준다. `unused<=0` 이면 맥락이 필요 없다.

## 3. 순수 함수 계약 — `src/utils/evaluationTimeline.ts` (U 구현)

골든 [`evaluationTimeline.test.ts`](../src/utils/evaluationTimeline.test.ts)가 정확한 시그니처·불변식을 못박는다. 요지:

```ts
// 입력 — 이미 조회·참여자해소된 행(조회/RLS/참여자해소는 화면·액션 몫)
interface MonitoringEntryInput { id; monitoringDate; method; observedChange; participantVoice; hasAllocation }
interface SettlementEntryInput { id; settledOn; settledPeriod; acceptedAmount; unusedAmount }
interface ReviewEntryInput     { id; reviewDate; decision; reason }

// 출력 — kind 로 구분되는 판별 유니온(렌더가 switch 하기 좋게)
type TimelineEntry =
  | { kind:'monitoring'; id; date; method; observedChange; participantVoice; hasAllocation }
  | { kind:'settlement'; id; date; settledPeriod; acceptedAmount; unusedAmount }
  | { kind:'review';     id; date; decision; reason }

function buildEvaluationTimeline(input): TimelineEntry[]          // §2 의 1~5
function unusedContext(settlement, monitorings): UnusedContext | undefined  // §2 의 6
interface UnusedContext { unusedAmount; relatedMonitoring: MonitoringEntryInput[] }
```

- `date` 는 각 소스의 날짜 컬럼을 통일한 `'YYYY-MM-DD'`.
- `unusedContext`: `unused<=0 → undefined`. `unused>0` 이면 항상 정의됨 — 기간 내 모니터링을 내림차순으로
  담고, 없으면 `relatedMonitoring: []`(= "미사용은 있는데 설명 기록이 없다"는 사실 자체가 신호).
- 기간 매칭은 `'YYYY-MM'` 접두 비교로 충분(단일월 `'2025-03'`, 범위 `'2025-03~2025-06'`). 일(day) 경계 계산 불필요.

## 4. 화면 배선 (U 구현)

### 4-1. 실무자 — `(supporter)/evaluations/[participantId]/page.tsx` (신규 통합)
- 참여자 해소로 세 배열을 모아 `buildEvaluationTimeline` 에 넣고 카드 타임라인 렌더.
  - **monitoring 카드**: `observedChange` 와 `participantVoice` 를 **시각적으로 분리된 두 블록**으로
    (예: 관찰 = 기본, 당사자 말 = 따옴표·다른 배경). 한쪽 없으면 그 블록은 접는다(빈 칸 강요 금지).
  - **settlement 카드**: 인정액·미사용액. `unusedContext` 결과가 있으면 그 아래 관련 모니터링을 접이식으로.
  - **review 카드**: 결정 배지(승인/조건부/부결) + 사유.
- **참여자 해소 책임(화면·액션)** — util 로 넘기기 전에 화면이 처리:
  - monitoring: `getMonitoringRecords(participantId)` 직접.
  - settlement: 참여자의 `seoul_budget_allocations` → 그 `allocation_id` 들의 `getSettlements`.
  - review: 참여자의 `seoul_utilization_plans` → 그 `plan_id` 들의 `seoul_plan_reviews`.
- 입력 폼(선택, 후속): `recordMonitoring` 을 이 화면에서 바로 — 관찰/당사자말 두 칸 분리 유지.

### 4-2. 당사자 미러 — `(participant)/evaluations/page.tsx` ('선생님의 편지' 계승)
- `ComingSoon` 제거, 같은 타임라인을 **쉬운 말**로. 본인 것만(RLS 가 이미 범위 강제).
- 프레이밍: 심의·정산 숫자보다 **`observedChange`(선생님이 본 나의 변화) + `participantVoice`(내가 한 말)**
  중심. "선생님의 편지 💌" 톤 유지. 부결·미사용 같은 부정 신호는 easy-read 로 완충(§6).

### 4-3. 고아 링크 수정
- `budgets/[id]:338` `href="/supporter/evaluations"` → **`/supporter/evaluations/${participantId}`**.

### 4-4. 레거시 폐기
- 삭제: `(supporter)/evaluations/[participantId]/[month]/page.tsx` · `[month]/plans/page.tsx` · `[participantId]/goals/page.tsx`.
- `(supporter)/evaluations/page.tsx` 는 참여자 선택 목록(또는 대시보드로) — 제네릭 ComingSoon 탈피.

## 5. easy-read / 접근성

- 카드·배지 44×44px 터치, `leading-relaxed` 이상.
- 부결/미사용 = 빨강 경보 아님. 중립 톤 + "왜"를 함께(사유·모니터링 맥락). 당사자 화면은 특히.
- 분리 불변식은 **접근성 요구이기도 하다** — 당사자의 말을 실무자 관찰로 덮어쓰면 자기결정권 훼손.
- 심의 결정 배지는 색만으로 의미 전달 금지(텍스트 라벨 병기).

## 6. U 착수 체크리스트

1. `src/utils/evaluationTimeline.ts` 구현 → 골든 초록(`vitest run evaluationTimeline`).
2. `(supporter)/evaluations/[participantId]/page.tsx` 신규(참여자 해소 → build → 카드 렌더).
3. `(participant)/evaluations/page.tsx` 실내용화('선생님의 편지', easy-read).
4. `budgets/[id]:338` 링크 참여자 지정으로 수정.
5. 레거시 라우트 3종 삭제(§4-4).
6. 게이트: `npm test` · `npm run build` · `npm run lint`(신규 error 0).
7. `[HANDOFF→W]` — 요구→타입→성능→보안→접근성→테스트 리뷰 + easy-read 리뷰 요청.

## 7. 남긴 판단 (진짜 W 복귀·사용자 확인 대기)

- 입력 폼(4-1 후속)을 이 스코프에 넣을지, 별도 PR 로 뺄지 — 우선 **읽기 타임라인**부터 초록화 권장.
- 심의 주체(committee) 표기 범위 — 지금은 결정·사유만. 통지/이의신청 타임라인 편입은 후속.
