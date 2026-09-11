/**
 * 실무자용 AI 점검 제안 — 신호층(결정론적·무AI·무DB). 계약: src/utils/staffReviewSignals.test.ts.
 * 설계: Plan&Source/goala_staff_review_assistant_W.md §2.
 *
 * 액션(src/app/actions/staffReviewSuggestion.ts)이 뷰·테이블에서 이미 조회한 원시값을 ReviewInput 으로
 * 넘기면, 여기서 결정론적으로 '점검 신호'를 뽑는다. 이 신호 요약만 가명처리해 AI 로 보내므로(§1)
 * 신호 규칙은 순수·테스트 가능해야 하고 AI 는 이 범위(basis) 안에서만 합성한다.
 */

export type ReviewSignalKind =
  | 'budget_ceiling'
  | 'copay_unsettled'
  | 'unplanned_spending'
  | 'rulecheck_pending'
  | 'plan_delayed'
  | 'isolation'

export type ReviewSeverity = 'high' | 'medium' | 'info'

export interface ReviewSignal {
  kind: ReviewSignalKind
  severity: ReviewSeverity
  /** 실무자용 한 줄 제목(한글). */
  label: string
  /** 실무자용 설명 문장(한글). */
  detail: string
}

export interface ReviewInput {
  /** 최신 월별 소진 현황 — 이번(최근) 달 사용액·월 한도·초과 여부. */
  budget: { monthSpent: number; monthlyCeiling: number; exceedsMonthlyCeiling: boolean }
  /** 아직 정산되지 않은 자부담 건수(없으면 0). */
  copayUnsettledCount: number
  /** 계획에 없던 지출 건수. */
  unplannedCount: number
  /** 사람 판단을 기다리는(pending) 규칙 점검 건수. */
  ruleChecksPending: number
  /** 최신 이용계획의 상태(없으면 null). */
  planStatus?: string | null
  /** 사회 관계망 요약. */
  network: { communityCount: number; lastContactDaysAgo: number | null; totalRelations: number }
}

const SEV_RANK: Record<ReviewSeverity, number> = { high: 3, medium: 2, info: 1 }

/** 월 한도 임박 기준(90%) · 계획외/점검대기 high 승격 기준(3건) · 마지막 접촉 고립 기준(60일). */
const CEILING_WARN_RATIO = 0.9
const HIGH_COUNT = 3
const ISOLATION_DAYS = 60

/**
 * 원시값 → 점검 신호. 각 규칙은 서로 독립(한 축만 본다). 모두 정상이면 [].
 * 반환은 severity 내림차순 → kind 오름차순으로 결정적 정렬(설계 §2).
 */
export function computeReviewSignals(input: ReviewInput): ReviewSignal[] {
  const signals: ReviewSignal[] = []

  // 1) 월 예산 한도 — 초과(high) 또는 90% 임박(medium).
  const { monthSpent, monthlyCeiling, exceedsMonthlyCeiling } = input.budget
  if (exceedsMonthlyCeiling) {
    signals.push({
      kind: 'budget_ceiling',
      severity: 'high',
      label: '월 예산 한도 초과',
      detail: '이번 달 사용액이 월 한도를 넘었어요. 계획을 다시 확인해 주세요.',
    })
  } else if (monthlyCeiling > 0 && monthSpent / monthlyCeiling >= CEILING_WARN_RATIO) {
    signals.push({
      kind: 'budget_ceiling',
      severity: 'medium',
      label: '월 예산 한도 임박',
      detail: '이번 달 사용액이 월 한도의 90%를 넘었어요. 남은 예산을 살펴 주세요.',
    })
  }

  // 2) 자부담 미정산.
  if (input.copayUnsettledCount > 0) {
    signals.push({
      kind: 'copay_unsettled',
      severity: 'medium',
      label: '자부담 미정산',
      detail: `아직 정산하지 않은 자부담이 ${input.copayUnsettledCount}건 있어요. 정산을 확인해 주세요.`,
    })
  }

  // 3) 계획에 없던 지출 — 3건 이상이면 high.
  if (input.unplannedCount > 0) {
    signals.push({
      kind: 'unplanned_spending',
      severity: input.unplannedCount >= HIGH_COUNT ? 'high' : 'medium',
      label: '계획에 없던 지출',
      detail: `계획에 없던 지출이 ${input.unplannedCount}건 있어요. 당사자와 함께 확인해 주세요.`,
    })
  }

  // 4) 규칙 점검 대기 — 3건 이상이면 high.
  if (input.ruleChecksPending > 0) {
    signals.push({
      kind: 'rulecheck_pending',
      severity: input.ruleChecksPending >= HIGH_COUNT ? 'high' : 'medium',
      label: '규칙 점검 대기',
      detail: `승인·반려를 기다리는 점검이 ${input.ruleChecksPending}건 있어요.`,
    })
  }

  // 5) 이용계획 심의 대기(제출·검토중).
  if (input.planStatus === 'submitted' || input.planStatus === 'under_review') {
    signals.push({
      kind: 'plan_delayed',
      severity: 'medium',
      label: '이용계획 심의 대기',
      detail: '이용계획이 아직 심의 중이에요. 진행 상황을 확인해 주세요.',
    })
  }

  // 6) 고립 위험 — 지역사회 연결이 없고, 접촉이 오래됐거나 관계가 1개 이하.
  const { communityCount, lastContactDaysAgo, totalRelations } = input.network
  const staleContact = lastContactDaysAgo != null && lastContactDaysAgo >= ISOLATION_DAYS
  if (communityCount === 0 && (staleContact || totalRelations <= 1)) {
    signals.push({
      kind: 'isolation',
      severity: 'medium',
      label: '지역사회 연결 부족',
      detail: '지역사회와 이어진 관계가 없어요. 사회 관계망을 함께 살펴 주세요.',
    })
  }

  return signals.sort(
    (a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || a.kind.localeCompare(b.kind),
  )
}
