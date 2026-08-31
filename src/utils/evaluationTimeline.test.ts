import { describe, it, expect } from 'vitest'
import {
  buildEvaluationTimeline,
  unusedContext,
  type MonitoringRow,
  type SettlementRow,
  type PlanReviewRow,
} from './evaluationTimeline'

/**
 * 평가(모니터링·정산·심의) 통합 타임라인 골든 — GOAL축 A 평가 화면 계약 (W 작성·소유, U 초록화).
 * 설계: Plan&Source/goala_evaluation_monitoring_ux_W.md.
 *
 * ★재정합 노트(실 W 복귀): API 형태(위치인자·중첩 row·string 반환)는 임시대행 구현(#64)을 계승하되,
 *   임시대행 골든이 놓쳤던 3가지를 W 독립검증으로 보강한다 —
 *   (A) 범위 정산기간('YYYY-MM~YYYY-MM'), (B) 동일 날짜·동일 kind 결정성, (C) 한쪽만 있는 관찰/당사자말.
 *
 * 불변식:
 *   1) 날짜 내림차순(최신 먼저). 정산의 정렬 키는 **settledOn**(실제 정산일) — settledPeriod 는 범위일 수
 *      있어(스키마 03:575 '2025-01~2025-06') 정렬 키로 못 쓴다(new Date(range)=Invalid).
 *   2) 동일 날짜 tie-break = monitoring > settlement > review. 같은 날짜·같은 kind 는 입력 순서 보존(결정성).
 *   3) 배정 없는(allocationId=null) 모니터링도 누락 없이 포함.
 *   4) ★분리 불변식 — observedChange/participantVoice 는 중첩 row 로 그대로 보존, 한쪽이 없으면 null 그대로.
 *   5) unusedContext: unused<=0 → undefined. 아니면 같은 배정 + settledPeriod(단일월 **또는 범위**)에
 *      겹치는 달의 관찰(observedChange)을 인용. 없으면 undefined(화면이 '확인 필요' 배지로 대체).
 *
 * RED: '@/utils/evaluationTimeline' 미존재 또는 위 불변식 미충족 → RED. U 가 계약대로 구현하면 green.
 */

const mon = (over: Partial<MonitoringRow> & { id: string; monitoringDate: string }): MonitoringRow => ({
  method: 'visit',
  observedChange: '표정이 밝아졌다',
  participantVoice: '요즘 재밌어요',
  allocationId: 'alloc-1',
  ...over,
})
const set = (
  over: Partial<SettlementRow> & { id: string; settledOn: string; settledPeriod: string }
): SettlementRow => ({
  allocationId: 'alloc-1',
  acceptedAmount: 100000,
  rejectedAmount: 0,
  recoveredAmount: 0,
  unusedAmount: 0,
  ...over,
})
const rev = (
  over: Partial<PlanReviewRow> & { id: string; reviewDate: string }
): PlanReviewRow => ({ decision: 'approved', reason: null, ...over })

describe('buildEvaluationTimeline — 병합·정렬', () => {
  it('빈 입력 3개는 빈 배열(널 아님)', () => {
    expect(buildEvaluationTimeline([], [], [])).toEqual([])
  })

  it('날짜 내림차순(최신 먼저)', () => {
    const result = buildEvaluationTimeline(
      [mon({ id: 'm-old', monitoringDate: '2026-01-05' }), mon({ id: 'm-new', monitoringDate: '2026-03-10' })],
      [],
      []
    )
    expect(result.map((e) => e.id)).toEqual(['m-new', 'm-old'])
  })

  it('동일 날짜 tie-break = monitoring > settlement > review', () => {
    const D = '2026-03-10'
    const result = buildEvaluationTimeline(
      [mon({ id: 'm', monitoringDate: D })],
      [set({ id: 's', settledOn: D, settledPeriod: '2026-03' })],
      [rev({ id: 'r', reviewDate: D })]
    )
    expect(result.map((e) => e.kind)).toEqual(['monitoring', 'settlement', 'review'])
    expect(result.map((e) => e.id)).toEqual(['m', 's', 'r'])
  })

  it('★결정성 — 같은 날짜·같은 kind 는 입력 순서를 보존(안정 정렬)', () => {
    const D = '2026-03-10'
    const result = buildEvaluationTimeline(
      [mon({ id: 'm1', monitoringDate: D }), mon({ id: 'm2', monitoringDate: D })],
      [],
      []
    )
    expect(result.map((e) => e.id)).toEqual(['m1', 'm2'])
  })

  it('★분리 불변식 — observedChange/participantVoice 를 중첩 row 로 분리 보존, 한쪽 없으면 null 그대로', () => {
    const result = buildEvaluationTimeline(
      [
        mon({ id: 'both', monitoringDate: '2026-03-10', observedChange: '외출이 늘었다', participantVoice: '카페가 좋아요' }),
        mon({ id: 'observed-only', monitoringDate: '2026-03-09', observedChange: '규칙적으로 나온다', participantVoice: null }),
      ],
      [],
      []
    )
    const both = result.find((e) => e.id === 'both')!.monitoring!
    const observedOnly = result.find((e) => e.id === 'observed-only')!.monitoring!
    expect(both.observedChange).toBe('외출이 늘었다')
    expect(both.participantVoice).toBe('카페가 좋아요')
    expect(both.observedChange).not.toBe(both.participantVoice)
    // 당사자말이 없다고 관찰 값으로 지어내지 않는다.
    expect(observedOnly.observedChange).toBe('규칙적으로 나온다')
    expect(observedOnly.participantVoice).toBeNull()
  })

  it('배정 없는(allocationId=null) 모니터링도 포함', () => {
    const result = buildEvaluationTimeline(
      [mon({ id: 'm-preassign', allocationId: null, monitoringDate: '2026-02-01' })],
      [],
      []
    )
    expect(result.map((e) => e.id)).toContain('m-preassign')
  })

  it('★범위(range) 정산기간도 settledOn 으로 정렬한다(new Date(range)=Invalid 회피)', () => {
    const result = buildEvaluationTimeline(
      [mon({ id: 'm-aug', monitoringDate: '2025-08-01' })],
      [set({ id: 's-h1', settledOn: '2025-07-01', settledPeriod: '2025-01~2025-06', unusedAmount: 0 })],
      []
    )
    // settledOn(2025-07-01) 기준으로 8월 모니터링 뒤에 온다 — 범위 문자열을 정렬 키로 쓰면 깨진다.
    expect(result.map((e) => e.id)).toEqual(['m-aug', 's-h1'])
  })

  it('3종이 섞여도 각 kind 원본 행을 그대로 보존한다', () => {
    const result = buildEvaluationTimeline(
      [mon({ id: 'm1', monitoringDate: '2026-03-15' })],
      [set({ id: 's1', settledOn: '2026-02-20', settledPeriod: '2026-02' })],
      [rev({ id: 'r1', reviewDate: '2026-01-01' })]
    )
    expect(result.find((e) => e.kind === 'monitoring')?.monitoring?.id).toBe('m1')
    expect(result.find((e) => e.kind === 'settlement')?.settlement?.id).toBe('s1')
    expect(result.find((e) => e.kind === 'review')?.review?.id).toBe('r1')
  })
})

describe('unusedContext — 미사용 맥락', () => {
  it('unused_amount<=0 이면 항상 undefined', () => {
    const m = [mon({ id: 'm', monitoringDate: '2026-03-10' })]
    expect(unusedContext(set({ id: 's0', settledOn: '2026-04-01', settledPeriod: '2026-03', unusedAmount: 0 }), m)).toBeUndefined()
    expect(unusedContext(set({ id: 'sn', settledOn: '2026-04-01', settledPeriod: '2026-03', unusedAmount: -1 }), m)).toBeUndefined()
  })

  it('단일월: 같은 배정·겹치는 달의 관찰을 인용한다', () => {
    const s = set({ id: 's', settledOn: '2026-04-01', settledPeriod: '2026-03', unusedAmount: 20000 })
    const m = [mon({ id: 'm', allocationId: 'alloc-1', monitoringDate: '2026-03-10', observedChange: '요즘 나갈 일이 적었다' })]
    expect(unusedContext(s, m)).toBe('요즘 나갈 일이 적었다')
  })

  it('★범위(YYYY-MM~YYYY-MM): 범위 안의 달을 매칭한다(첫 달만 보지 않는다)', () => {
    const s = set({ id: 's-h1', settledOn: '2025-07-01', settledPeriod: '2025-01~2025-06', allocationId: 'alloc-1', unusedAmount: 30000 })
    // 4월은 범위(01~06) 안 — .slice(0,7)='2025-01' 로만 보면 놓친다.
    const m = [mon({ id: 'm-apr', allocationId: 'alloc-1', monitoringDate: '2025-04-10', observedChange: '4월엔 병원 일정이 많았다' })]
    expect(unusedContext(s, m)).toBe('4월엔 병원 일정이 많았다')
  })

  it('겹치는 모니터링이 없으면 undefined(화면이 확인 필요 배지로 대체)', () => {
    const s = set({ id: 's', settledOn: '2026-04-01', settledPeriod: '2026-03', allocationId: 'alloc-1', unusedAmount: 20000 })
    const m = [mon({ id: 'm', allocationId: 'alloc-1', monitoringDate: '2026-01-01' })] // 다른 달
    expect(unusedContext(s, m)).toBeUndefined()
  })

  it('다른 배정의 모니터링은 매칭하지 않는다', () => {
    const s = set({ id: 's', settledOn: '2026-04-01', settledPeriod: '2026-03', allocationId: 'alloc-1', unusedAmount: 20000 })
    const m = [mon({ id: 'm', allocationId: 'alloc-2', monitoringDate: '2026-03-10', observedChange: '남의 기록' })]
    expect(unusedContext(s, m)).toBeUndefined()
  })
})
