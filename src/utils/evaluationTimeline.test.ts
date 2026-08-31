import { describe, it, expect } from 'vitest'
import {
  buildEvaluationTimeline,
  unusedContext,
  type MonitoringEntryInput,
  type SettlementEntryInput,
  type ReviewEntryInput,
  type TimelineEntry,
} from '@/utils/evaluationTimeline'

/**
 * 평가(모니터링·정산·심의) 통합 타임라인 — test-first 골든 계약 (W 작성, U 초록화).
 * 설계: Plan&Source/goala_evaluation_monitoring_ux_W.md
 *
 * 서울형에는 4+1 같은 정형 평가가 없다(schema §11 주석). 성과평가에 쓸 변화 기록은
 * 사실상 세 곳에 흩어져 있다 — 모니터링(seoul_monitoring_records)·정산(seoul_settlements)·
 * 심의(seoul_plan_reviews). 이 순수 함수는 이미 조회·참여자해소된 세 배열을 하나의
 * 시간 순 타임라인으로 접는다(조회·RLS·참여자해소는 화면/액션 레이어 몫).
 *
 * ★계약이 못박는 불변식:
 *   1) 날짜 내림차순(최신 먼저) — 각 소스의 date 컬럼: monitoring_date / settled_on / review_date.
 *   2) 동일 날짜 tie-break = monitoring > settlement > review (관찰이 먼저 읽혀야 정산·심의가 해석된다).
 *   3) 결정성 — 같은 날짜·같은 종류는 입력 순서를 그대로 보존(안정 정렬).
 *   4) 배정(allocation) 없는 모니터링도 포함한다(hasAllocation=false 를 걸러내지 않는다).
 *   5) ★분리 불변식 — observedChange(실무자 관찰)와 participantVoice(당사자 본인의 말)는
 *      끝까지 다른 필드로 남는다. 한쪽이 없으면 null 그대로(상대 값으로 지어내지 않는다).
 *
 * unusedContext: 정산의 미사용액은 실패가 아니다 — "쓸 곳을 못 찾아서"인지 "필요가 없어서"인지는
 *   같은 기간 모니터링과 함께 읽어야 안다(schema §11 주석). unused<=0 이면 맥락이 필요 없다(→ undefined).
 *
 * RED: '@/utils/evaluationTimeline' 미존재 → import 실패로 스위트 전체 RED. U 가 계약대로 구현하면 초록.
 */

// ── 입력 팩토리 (읽기 쉬운 케이스용) ────────────────────────────────────────
function mon(over: Partial<MonitoringEntryInput> & { id: string; monitoringDate: string }): MonitoringEntryInput {
  return {
    method: 'visit',
    observedChange: null,
    participantVoice: null,
    hasAllocation: true,
    ...over,
  }
}
function set(
  over: Partial<SettlementEntryInput> & { id: string; settledOn: string; settledPeriod: string }
): SettlementEntryInput {
  return { acceptedAmount: 0, unusedAmount: 0, ...over }
}
function rev(
  over: Partial<ReviewEntryInput> & { id: string; reviewDate: string; decision: ReviewEntryInput['decision'] }
): ReviewEntryInput {
  return { reason: null, ...over }
}

describe('buildEvaluationTimeline — 통합 타임라인 계약', () => {
  it('빈 입력 → 빈 타임라인', () => {
    expect(buildEvaluationTimeline({ monitorings: [], settlements: [], reviews: [] })).toEqual([])
  })

  it('세 소스를 하나의 타임라인으로 병합한다(개수·종류 보존)', () => {
    const timeline = buildEvaluationTimeline({
      monitorings: [mon({ id: 'm1', monitoringDate: '2025-03-10' })],
      settlements: [set({ id: 's1', settledOn: '2025-06-30', settledPeriod: '2025-01~2025-06' })],
      reviews: [rev({ id: 'r1', reviewDate: '2025-02-01', decision: 'approved' })],
    })
    expect(timeline).toHaveLength(3)
    expect(timeline.map((e) => e.kind).sort()).toEqual(['monitoring', 'review', 'settlement'])
  })

  it('날짜 내림차순으로 정렬한다(최신 먼저)', () => {
    const timeline = buildEvaluationTimeline({
      monitorings: [mon({ id: 'm-mid', monitoringDate: '2025-05-02' })],
      settlements: [set({ id: 's-new', settledOn: '2025-06-30', settledPeriod: '2025-06' })],
      reviews: [rev({ id: 'r-old', reviewDate: '2025-02-01', decision: 'rejected', reason: '서류 미비' })],
    })
    expect(timeline.map((e) => e.date)).toEqual(['2025-06-30', '2025-05-02', '2025-02-01'])
    expect(timeline.map((e) => e.id)).toEqual(['s-new', 'm-mid', 'r-old'])
  })

  it('동일 날짜 tie-break = monitoring > settlement > review, 같은 종류는 입력 순서 보존(결정성)', () => {
    const D = '2025-03-10'
    const timeline = buildEvaluationTimeline({
      // 입력 순서를 일부러 섞어 넣는다 — 출력이 tie-break 규칙으로 재정렬되는지 본다.
      reviews: [rev({ id: 'r', reviewDate: D, decision: 'approved' })],
      settlements: [set({ id: 's', settledOn: D, settledPeriod: '2025-03' })],
      monitorings: [
        mon({ id: 'm1', monitoringDate: D }),
        mon({ id: 'm2', monitoringDate: D }),
      ],
    })
    // 같은 날짜 안에서: 모니터링(입력 순 m1,m2) → 정산 → 심의
    expect(timeline.map((e) => e.kind)).toEqual(['monitoring', 'monitoring', 'settlement', 'review'])
    expect(timeline.map((e) => e.id)).toEqual(['m1', 'm2', 's', 'r'])
  })

  it('배정(allocation) 없는 모니터링도 타임라인에 포함한다', () => {
    const timeline = buildEvaluationTimeline({
      monitorings: [
        mon({ id: 'm-with', monitoringDate: '2025-03-10', hasAllocation: true }),
        mon({ id: 'm-without', monitoringDate: '2025-03-09', hasAllocation: false }),
      ],
      settlements: [],
      reviews: [],
    })
    const without = timeline.find((e) => e.id === 'm-without')
    expect(without).toBeDefined()
    expect(without).toMatchObject({ kind: 'monitoring', hasAllocation: false })
    expect(timeline).toHaveLength(2)
  })

  it('★분리 불변식 — observedChange 와 participantVoice 는 다른 필드로 보존, 없으면 null 그대로', () => {
    const timeline = buildEvaluationTimeline({
      monitorings: [
        mon({
          id: 'both',
          monitoringDate: '2025-03-10',
          observedChange: '외출이 늘었어요',
          participantVoice: '카페가 좋아요',
        }),
        // 관찰만 있고 당사자 말은 없음 — participantVoice 를 observedChange 로 지어내면 안 된다.
        mon({ id: 'observed-only', monitoringDate: '2025-03-09', observedChange: '규칙적으로 나옵니다', participantVoice: null }),
      ],
      settlements: [],
      reviews: [],
    })
    const both = timeline.find((e) => e.id === 'both')
    const observedOnly = timeline.find((e) => e.id === 'observed-only')
    expect(both).toMatchObject({ observedChange: '외출이 늘었어요', participantVoice: '카페가 좋아요' })
    // 두 칸이 서로 다른 값으로 유지된다(합쳐지지 않는다).
    expect((both as Extract<TimelineEntry, { kind: 'monitoring' }>).observedChange).not.toBe(
      (both as Extract<TimelineEntry, { kind: 'monitoring' }>).participantVoice
    )
    expect(observedOnly).toMatchObject({ observedChange: '규칙적으로 나옵니다', participantVoice: null })
  })
})

describe('unusedContext — 미사용액 해석 맥락 계약', () => {
  const monitorings: MonitoringEntryInput[] = [
    mon({ id: 'm-mar-a', monitoringDate: '2025-03-05', observedChange: '3월 초 관찰' }),
    mon({ id: 'm-mar-b', monitoringDate: '2025-03-20', observedChange: '3월 말 관찰' }),
    mon({ id: 'm-may', monitoringDate: '2025-05-10', observedChange: '5월 관찰' }),
    mon({ id: 'm-aug', monitoringDate: '2025-08-01', observedChange: '8월 관찰' }),
  ]

  it('미사용 0 또는 음수 → 항상 undefined(맥락 불필요)', () => {
    expect(unusedContext(set({ id: 's0', settledOn: '2025-04-01', settledPeriod: '2025-03', unusedAmount: 0 }), monitorings)).toBeUndefined()
    expect(unusedContext(set({ id: 'sneg', settledOn: '2025-04-01', settledPeriod: '2025-03', unusedAmount: -100 }), monitorings)).toBeUndefined()
  })

  it('단일월 기간: 그 달의 모니터링만, 날짜 내림차순으로 맥락에 담는다', () => {
    const ctx = unusedContext(
      set({ id: 's-mar', settledOn: '2025-04-01', settledPeriod: '2025-03', unusedAmount: 50000 }),
      monitorings
    )
    expect(ctx).toBeDefined()
    expect(ctx!.unusedAmount).toBe(50000)
    // 3월 두 건만(5월·8월 제외), 내림차순(3-20 먼저).
    expect(ctx!.relatedMonitoring.map((m) => m.id)).toEqual(['m-mar-b', 'm-mar-a'])
  })

  it('범위 기간(YYYY-MM~YYYY-MM): 범위 안 모든 달을 포함하고 밖은 제외한다', () => {
    const ctx = unusedContext(
      set({ id: 's-h1', settledOn: '2025-07-01', settledPeriod: '2025-03~2025-06', unusedAmount: 120000 }),
      monitorings
    )
    expect(ctx).toBeDefined()
    // 3월·5월 포함(내림차순: 5-10, 3-20, 3-05), 8월 제외.
    expect(ctx!.relatedMonitoring.map((m) => m.id)).toEqual(['m-may', 'm-mar-b', 'm-mar-a'])
  })

  it('미사용>0 이지만 기간 내 모니터링이 없으면 relatedMonitoring 은 빈 배열(맥락은 정의됨)', () => {
    const ctx = unusedContext(
      set({ id: 's-sep', settledOn: '2025-10-01', settledPeriod: '2025-09', unusedAmount: 30000 }),
      monitorings
    )
    // undefined 가 아니라 "미사용은 있는데 설명 기록이 없다"는 사실을 담는다.
    expect(ctx).toEqual({ unusedAmount: 30000, relatedMonitoring: [] })
  })
})
