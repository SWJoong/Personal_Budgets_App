import { describe, it, expect } from 'vitest'
import {
  computeReviewSignals,
  type ReviewInput,
  type ReviewSignal,
  type ReviewSignalKind,
} from './staffReviewSignals'

/**
 * 실무자용 AI 점검 제안 — 신호층(결정론적) golden 계약 (W 레인). 관리자 QA #6.
 * 설계출처: Plan&Source/goala_staff_review_assistant_W.md §2.
 * 구현 대상: src/utils/staffReviewSignals.ts.
 *
 * 배경: 예산 이행·점검 원시값(이미 조회됨)에서 결정론적으로 점검 신호를 뽑는다. 이 신호 요약만
 *   가명처리해 AI 로 보내므로(§1), 신호 규칙은 순수·테스트 가능해야 하고 AI 는 이 범위 안에서만 합성한다.
 *
 * RED 사유: computeReviewSignals/ReviewInput/ReviewSignal 이 아직 없다(tsc + 런타임 실패).
 */

const SEV_RANK = { high: 3, medium: 2, info: 1 } as const

function byKind(signals: ReviewSignal[], kind: ReviewSignalKind): ReviewSignal | undefined {
  return signals.find((s) => s.kind === kind)
}

// 모든 값이 정상인 기준 입력(각 테스트가 한 축만 흔든다).
const CLEAR: ReviewInput = {
  budget: { monthSpent: 100000, monthlyCeiling: 1000000, exceedsMonthlyCeiling: false },
  copayUnsettledCount: 0,
  unplannedCount: 0,
  ruleChecksPending: 0,
  planStatus: 'approved',
  network: { communityCount: 2, lastContactDaysAgo: 7, totalRelations: 5 },
}

describe('computeReviewSignals — 신호층(#6)', () => {
  it('모두 정상이면 신호가 없다(전부 green → [])', () => {
    expect(computeReviewSignals(CLEAR)).toEqual([])
  })

  it('월 한도 초과 → budget_ceiling high', () => {
    const s = computeReviewSignals({ ...CLEAR, budget: { monthSpent: 1200000, monthlyCeiling: 1000000, exceedsMonthlyCeiling: true } })
    expect(byKind(s, 'budget_ceiling')?.severity).toBe('high')
  })

  it('월 한도 90% 이상 임박(미초과) → budget_ceiling medium', () => {
    const s = computeReviewSignals({ ...CLEAR, budget: { monthSpent: 920000, monthlyCeiling: 1000000, exceedsMonthlyCeiling: false } })
    expect(byKind(s, 'budget_ceiling')?.severity).toBe('medium')
  })

  it('한도의 90% 미만이면 예산 신호 없음', () => {
    const s = computeReviewSignals({ ...CLEAR, budget: { monthSpent: 500000, monthlyCeiling: 1000000, exceedsMonthlyCeiling: false } })
    expect(byKind(s, 'budget_ceiling')).toBeUndefined()
  })

  it('자부담 미정산 건 있으면 → copay_unsettled', () => {
    const s = computeReviewSignals({ ...CLEAR, copayUnsettledCount: 2 })
    expect(byKind(s, 'copay_unsettled')).toBeDefined()
  })

  it('계획외 지출 1~2건 → unplanned medium, 3건 이상 → high', () => {
    expect(byKind(computeReviewSignals({ ...CLEAR, unplannedCount: 2 }), 'unplanned_spending')?.severity).toBe('medium')
    expect(byKind(computeReviewSignals({ ...CLEAR, unplannedCount: 4 }), 'unplanned_spending')?.severity).toBe('high')
  })

  it('규칙점검 대기 1~2건 → medium, 3건 이상 → high', () => {
    expect(byKind(computeReviewSignals({ ...CLEAR, ruleChecksPending: 1 }), 'rulecheck_pending')?.severity).toBe('medium')
    expect(byKind(computeReviewSignals({ ...CLEAR, ruleChecksPending: 3 }), 'rulecheck_pending')?.severity).toBe('high')
  })

  it('이용계획이 심의 단계(submitted/under_review)면 → plan_delayed', () => {
    expect(byKind(computeReviewSignals({ ...CLEAR, planStatus: 'under_review' }), 'plan_delayed')).toBeDefined()
    expect(byKind(computeReviewSignals({ ...CLEAR, planStatus: 'submitted' }), 'plan_delayed')).toBeDefined()
    expect(byKind(computeReviewSignals({ ...CLEAR, planStatus: 'approved' }), 'plan_delayed')).toBeUndefined()
  })

  it('지역사회 연결 0 + 접촉 60일 이상 → isolation', () => {
    const s = computeReviewSignals({ ...CLEAR, network: { communityCount: 0, lastContactDaysAgo: 90, totalRelations: 3 } })
    expect(byKind(s, 'isolation')).toBeDefined()
  })

  it('지역사회 연결 0 + 관계 1개 이하 → isolation(접촉일 없어도)', () => {
    const s = computeReviewSignals({ ...CLEAR, network: { communityCount: 0, lastContactDaysAgo: null, totalRelations: 1 } })
    expect(byKind(s, 'isolation')).toBeDefined()
  })

  it('지역사회 연결이 있으면 고립 신호 없음', () => {
    const s = computeReviewSignals({ ...CLEAR, network: { communityCount: 1, lastContactDaysAgo: 200, totalRelations: 1 } })
    expect(byKind(s, 'isolation')).toBeUndefined()
  })

  it('여러 신호는 severity 내림차순으로 정렬된다(high가 medium보다 앞)', () => {
    const s = computeReviewSignals({
      ...CLEAR,
      budget: { monthSpent: 1200000, monthlyCeiling: 1000000, exceedsMonthlyCeiling: true }, // high
      planStatus: 'under_review', // medium
      copayUnsettledCount: 1, // medium
    })
    const ranks = s.map((x) => SEV_RANK[x.severity])
    const sorted = [...ranks].sort((a, b) => b - a)
    expect(ranks).toEqual(sorted)
    expect(s[0].severity).toBe('high')
    // 각 신호는 한 번씩만
    expect(new Set(s.map((x) => x.kind)).size).toBe(s.length)
  })

  it('label·detail 은 비어있지 않은 한글 실무 문장', () => {
    const s = computeReviewSignals({ ...CLEAR, ruleChecksPending: 5 })
    const rc = byKind(s, 'rulecheck_pending')!
    expect(rc.label.length).toBeGreaterThan(0)
    expect(rc.detail.length).toBeGreaterThan(0)
  })
})
