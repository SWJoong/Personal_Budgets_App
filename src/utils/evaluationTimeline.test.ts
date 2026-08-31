import { describe, it, expect } from 'vitest'
import {
  buildEvaluationTimeline,
  unusedContext,
  type MonitoringRow,
  type SettlementRow,
  type PlanReviewRow,
} from './evaluationTimeline'

/**
 * 정산·평가 타임라인 병합 골든 — GOAL축 A 평가(모니터링·정산) 화면.
 * 설계: Plan&Source/goala_evaluation_monitoring_ux_W.md §7. 순수함수라 DB·렌더 없이 불변식을 못박는다.
 *
 * ★ 이 골든은 test-first(W)로 RED 다 — src/utils/evaluationTimeline.ts 가 아직 없다.
 *   U 가 buildEvaluationTimeline/unusedContext 를 구현하면 green. 핵심 불변식:
 *
 *   (1) observedChange/participantVoice 는 절대 합쳐지지 않는다(스키마 §11 주석의 화면판).
 *   (2) 날짜 내림차순, 동일 날짜는 monitoring > settlement > review 순.
 *   (3) 배정 없는(allocationId=null) 모니터링도 누락 없이 포함.
 *   (4) unused_amount<=0 이면 unusedContext 는 항상 undefined.
 */

const monitoring = (over: Partial<MonitoringRow> = {}): MonitoringRow => ({
  id: 'm1',
  monitoringDate: '2026-03-10',
  method: 'visit',
  observedChange: '표정이 밝아졌다',
  participantVoice: '요즘 재밌어요',
  allocationId: 'alloc-1',
  ...over,
})

const settlement = (over: Partial<SettlementRow> = {}): SettlementRow => ({
  id: 's1',
  allocationId: 'alloc-1',
  settledPeriod: '2026-03',
  acceptedAmount: 100000,
  rejectedAmount: 0,
  recoveredAmount: 0,
  unusedAmount: 0,
  ...over,
})

const review = (over: Partial<PlanReviewRow> = {}): PlanReviewRow => ({
  id: 'r1',
  decision: 'approved',
  reason: null,
  reviewDate: '2026-03-01',
  ...over,
})

describe('buildEvaluationTimeline — 병합·정렬', () => {
  it('빈 입력 3개는 빈 배열(널 아님)', () => {
    expect(buildEvaluationTimeline([], [], [])).toEqual([])
  })

  it('날짜 내림차순으로 정렬된다', () => {
    const result = buildEvaluationTimeline(
      [monitoring({ id: 'm-old', monitoringDate: '2026-01-05' }), monitoring({ id: 'm-new', monitoringDate: '2026-03-10' })],
      [],
      []
    )
    expect(result.map((e) => e.id)).toEqual(['m-new', 'm-old'])
  })

  it('동일 날짜는 monitoring > settlement > review 순', () => {
    const sameDate = '2026-03-10'
    const result = buildEvaluationTimeline(
      [monitoring({ id: 'm1', monitoringDate: sameDate })],
      [settlement({ id: 's1', settledPeriod: sameDate })].map((s) => ({ ...s })),
      [review({ id: 'r1', reviewDate: sameDate })]
    )
    // settlement/review 는 date 필드를 각자 settledPeriod/reviewDate 로부터 채택(구현이 정렬 키로 씀)
    const kinds = result.filter((e) => e.date.startsWith('2026-03')).map((e) => e.kind)
    expect(kinds).toEqual(['monitoring', 'settlement', 'review'])
  })

  it('observedChange 와 participantVoice 는 병합 후에도 분리 유지', () => {
    const result = buildEvaluationTimeline([monitoring()], [], [])
    expect(result[0].monitoring?.observedChange).toBe('표정이 밝아졌다')
    expect(result[0].monitoring?.participantVoice).toBe('요즘 재밌어요')
    expect(result[0].monitoring?.observedChange).not.toContain('재밌어요')
  })

  it('배정 없는(allocationId=null) 모니터링도 포함된다', () => {
    const result = buildEvaluationTimeline(
      [monitoring({ id: 'm-preassign', allocationId: null, monitoringDate: '2026-02-01' })],
      [],
      []
    )
    expect(result.map((e) => e.id)).toContain('m-preassign')
  })

  it('3종 전부 섞여도 각 kind 원본 행을 그대로 보존한다', () => {
    const result = buildEvaluationTimeline(
      [monitoring({ monitoringDate: '2026-03-15' })],
      [settlement({ settledPeriod: '2026-02' })],
      [review({ reviewDate: '2026-01-01' })]
    )
    expect(result.find((e) => e.kind === 'monitoring')?.monitoring?.id).toBe('m1')
    expect(result.find((e) => e.kind === 'settlement')?.settlement?.id).toBe('s1')
    expect(result.find((e) => e.kind === 'review')?.review?.id).toBe('r1')
  })
})

describe('unusedContext — 미사용 맥락', () => {
  it('unused_amount<=0 이면 항상 undefined', () => {
    expect(unusedContext(settlement({ unusedAmount: 0 }), [monitoring()])).toBeUndefined()
    expect(unusedContext(settlement({ unusedAmount: -1 }), [monitoring()])).toBeUndefined()
  })

  it('같은 배정·겹치는 기간의 모니터링 발췌를 인용한다', () => {
    const s = settlement({ unusedAmount: 20000, settledPeriod: '2026-03' })
    const m = monitoring({ allocationId: 'alloc-1', monitoringDate: '2026-03-10', observedChange: '요즘 나갈 일이 적었다' })
    expect(unusedContext(s, [m])).toBe('요즘 나갈 일이 적었다')
  })

  it('겹치는 모니터링이 없으면 undefined(화면이 확인 필요 배지로 대체)', () => {
    const s = settlement({ unusedAmount: 20000, settledPeriod: '2026-03', allocationId: 'alloc-1' })
    const m = monitoring({ allocationId: 'alloc-1', monitoringDate: '2026-01-01' }) // 다른 달
    expect(unusedContext(s, [m])).toBeUndefined()
  })

  it('다른 배정의 모니터링은 매칭하지 않는다', () => {
    const s = settlement({ unusedAmount: 20000, settledPeriod: '2026-03', allocationId: 'alloc-1' })
    const m = monitoring({ allocationId: 'alloc-2', monitoringDate: '2026-03-10', observedChange: '남의 기록' })
    expect(unusedContext(s, [m])).toBeUndefined()
  })
})
