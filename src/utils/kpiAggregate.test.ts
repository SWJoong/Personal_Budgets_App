import { describe, it, expect } from 'vitest'
import {
  aggregateFunnel,
  aggregateExecution,
  aggregateMonthly,
  aggregateUnplanned,
  aggregateSettlement,
  monitoringCoverage,
} from './kpiAggregate'

/**
 * 관리자 KPI 집계 순수 로직 계약 — docs/release/14 P2(#12). A·B·C 지표(D 보류).
 */

describe('aggregateFunnel (A)', () => {
  it('단계별 인원·선정률·심의분포를 센다', () => {
    const r = aggregateFunnel([
      { application_id: 'app1', application_status: 'selected', is_selected: true, plan_id: 'p1', plan_status: 'approved', review_decision: 'approved', notified_on: '2026-01-01', allocation_id: 'a1' },
      { application_id: 'app2', application_status: 'not_selected', is_selected: false, plan_id: null, plan_status: null, review_decision: null, notified_on: null, allocation_id: null },
      { application_id: 'app3', application_status: 'screening', is_selected: null, plan_id: null, plan_status: null, review_decision: null, notified_on: null, allocation_id: null },
      { application_id: 'app4', application_status: 'draft', is_selected: null, plan_id: null, plan_status: null, review_decision: null, notified_on: null, allocation_id: null },
    ])
    expect(r.applied).toBe(3) // draft 제외
    expect(r.selected).toBe(1)
    expect(r.planned).toBe(1)
    expect(r.approved).toBe(1)
    expect(r.allocated).toBe(1)
    expect(r.notified).toBe(1)
    expect(r.selectionRatePct).toBe(50) // 1 / (1 selected + 1 not_selected)
    expect(r.planStatusCounts).toEqual({ approved: 1 })
  })

  it('★fan-out dedup: 한 신청이 재심의(review 2행)로 여러 행이어도 1건으로 센다', () => {
    // 계획 p1 이 conditional→approved 로 review 2건 → 파이프라인 뷰가 2행 fan-out
    const r = aggregateFunnel([
      { application_id: 'app1', application_status: 'selected', is_selected: true, plan_id: 'p1', plan_status: 'approved', review_decision: 'conditional', notified_on: null, allocation_id: 'a1' },
      { application_id: 'app1', application_status: 'selected', is_selected: true, plan_id: 'p1', plan_status: 'approved', review_decision: 'approved', notified_on: '2026-02-01', allocation_id: 'a1' },
    ])
    expect(r.applied).toBe(1) // 신청 1건(중복 아님)
    expect(r.selected).toBe(1)
    expect(r.planned).toBe(1) // 계획 1개
    expect(r.approved).toBe(1) // 승인 1개(review 2건이어도)
    expect(r.allocated).toBe(1) // 배정 1개
    expect(r.notified).toBe(1)
    expect(r.planStatusCounts).toEqual({ approved: 1 }) // 계획 단위 분포(2행 아님)
  })

  it('빈 입력·선정 결정 없음 → 0·선정률 null', () => {
    const r = aggregateFunnel([])
    expect(r.applied).toBe(0)
    expect(r.selectionRatePct).toBeNull()
  })
})

describe('aggregateExecution (B)', () => {
  it('총액·집행률·구간·미집행을 센다(text 금액 방어)', () => {
    const r = aggregateExecution([
      { allocated_amount: '1000000', spent: '0', remaining: '1000000' }, // 미집행·저집행
      { allocated_amount: 1000000, spent: 200000, remaining: 800000 }, // 저집행 20%
      { allocated_amount: 1000000, spent: 500000, remaining: 500000 }, // 정상 50%
      { allocated_amount: 1000000, spent: 950000, remaining: 50000 }, // 고집행 95%
      { allocated_amount: 0, spent: 0, remaining: 0 }, // 배정 0 → 구간 제외
    ])
    expect(r.totalAllocated).toBe(4000000)
    expect(r.totalSpent).toBe(1650000)
    expect(r.executionPct).toBe(41.3) // 1650000/4000000 = 41.25 → 41.3
    expect(r.bands).toEqual({ low: 2, normal: 1, high: 1 })
    expect(r.unexecuted).toBe(1)
  })

  it('총 배정 0 → 집행률 null', () => {
    expect(aggregateExecution([]).executionPct).toBeNull()
    expect(aggregateExecution([{ allocated_amount: 0, spent: 0 }]).executionPct).toBeNull()
  })
})

describe('aggregateMonthly (B)', () => {
  it('참여자별 최신 월만으로 초과·임박을 센다', () => {
    const r = aggregateMonthly([
      { participant_id: 'a', month: '2026-01-01', monthly_ceiling: 100, month_spent: 50, exceeds_monthly_ceiling: false }, // 옛달
      { participant_id: 'a', month: '2026-02-01', monthly_ceiling: 100, month_spent: 120, exceeds_monthly_ceiling: true }, // 최신=초과
      { participant_id: 'b', month: '2026-02-01', monthly_ceiling: 100, month_spent: 95, exceeds_monthly_ceiling: false }, // 임박 95%
      { participant_id: 'c', month: '2026-02-01', monthly_ceiling: 100, month_spent: 10, exceeds_monthly_ceiling: false }, // 정상
    ])
    expect(r.exceeded).toBe(1) // a
    expect(r.nearLimit).toBe(1) // b
  })
})

describe('aggregateUnplanned (B)', () => {
  it('건수와 참여자 수(중복제거)를 센다', () => {
    const r = aggregateUnplanned([{ participant_id: 'a' }, { participant_id: 'a' }, { participant_id: 'b' }])
    expect(r.count).toBe(3)
    expect(r.participants).toBe(2)
  })
})

describe('aggregateSettlement (C)', () => {
  it('상태별 건수를 센다(환수=recovered)', () => {
    const r = aggregateSettlement([
      { settlement_status: 'pending' },
      { settlement_status: 'pending' },
      { settlement_status: 'accepted' },
      { settlement_status: 'recovered' },
      { settlement_status: 'rejected' },
      { settlement_status: null },
      { settlement_status: '이상값' },
    ])
    expect(r).toEqual({ pending: 2, accepted: 1, rejected: 1, recovered: 1 })
  })
})

describe('monitoringCoverage (C)', () => {
  it('최근 모니터링 받은 당사자 비율(중복제거)', () => {
    const r = monitoringCoverage(['a', 'a', 'b', null, undefined], 10)
    expect(r.covered).toBe(2)
    expect(r.total).toBe(10)
    expect(r.pct).toBe(20)
  })

  it('전체 0 → 비율 null', () => {
    expect(monitoringCoverage([], 0).pct).toBeNull()
  })
})
