import { describe, it, expect } from 'vitest'
import { buildOrgLedger, type OrgUsageRow } from './orgLedger'

/**
 * org 거래장부 집계 골든 — GOAL축 A · `supporter/transactions`.
 * 설계: Plan&Source/goala_comingsoon_stubs_triage_W.md §5 (test-first, W).
 *
 * 순수함수라 DB·렌더 없이 그룹핑·정산상태 롤업·정렬·회계 무결성을 못박는다.
 * 입력 OrgUsageRow 는 DB 행 shape 과 분리(U 가 getServiceUsages() 결과를 이 형태로 매핑).
 * 실무자는 RLS 로 자기 담당분만 조회하므로 이 함수는 "보이는 행"만 집계한다(스코프는 쿼리가 담당).
 */

// 짧은 헬퍼 — 테스트 가독성용
const row = (
  id: string,
  participantId: string,
  participantName: string,
  amount: number | null,
  settlementStatus: string,
  usageDate: string,
): OrgUsageRow => ({ id, participantId, participantName, amount, settlementStatus, usageDate })

describe('buildOrgLedger — 당사자별 그룹핑 (불변식 1)', () => {
  it('같은 participantId 행이 total·count 로 합산되고 이름은 대표값', () => {
    const out = buildOrgLedger([
      row('u1', 'p1', '김지수', 10000, 'pending', '2026-08-01'),
      row('u2', 'p1', '김지수', 5000, 'accepted', '2026-08-03'),
      row('u3', 'p2', '이서준', 3000, 'pending', '2026-08-02'),
    ])
    const p1 = out.participants.find(p => p.participantId === 'p1')!
    expect(p1.total).toBe(15000)
    expect(p1.count).toBe(2)
    expect(p1.participantName).toBe('김지수')
    const p2 = out.participants.find(p => p.participantId === 'p2')!
    expect(p2.total).toBe(3000)
    expect(p2.count).toBe(1)
  })
})

describe('buildOrgLedger — 정산상태 롤업 (불변식 2)', () => {
  it('4표준 버킷 + 미지 상태는 other 로(누락 금지)', () => {
    const out = buildOrgLedger([
      row('u1', 'p1', 'A', 1000, 'pending', '2026-08-01'),
      row('u2', 'p1', 'A', 2000, 'accepted', '2026-08-01'),
      row('u3', 'p1', 'A', 3000, 'rejected', '2026-08-01'),
      row('u4', 'p1', 'A', 4000, 'recovered', '2026-08-01'),
      row('u5', 'p1', 'A', 500, 'weird_unknown_status', '2026-08-01'),
    ])
    expect(out.byStatus.pending).toEqual({ amount: 1000, count: 1 })
    expect(out.byStatus.accepted).toEqual({ amount: 2000, count: 1 })
    expect(out.byStatus.rejected).toEqual({ amount: 3000, count: 1 })
    expect(out.byStatus.recovered).toEqual({ amount: 4000, count: 1 })
    expect(out.byStatus.other).toEqual({ amount: 500, count: 1 })
  })
})

describe('buildOrgLedger — null amount (불변식 3)', () => {
  it('null 금액은 0으로 합산하되 건수엔 포함', () => {
    const out = buildOrgLedger([
      row('u1', 'p1', 'A', null, 'pending', '2026-08-01'),
      row('u2', 'p1', 'A', 2000, 'pending', '2026-08-02'),
    ])
    const p1 = out.participants[0]
    expect(p1.total).toBe(2000)
    expect(p1.count).toBe(2)
    expect(out.byStatus.pending).toEqual({ amount: 2000, count: 2 })
  })
})

describe('buildOrgLedger — 정렬 결정성 (불변식 4)', () => {
  it('total 내림차순 → 동률 시 participantName 오름차순', () => {
    const out = buildOrgLedger([
      row('u1', 'p-low', '가나다', 1000, 'pending', '2026-08-01'),
      row('u2', 'p-hi', '하마', 9000, 'pending', '2026-08-01'),
      row('u3', 'p-tieB', '나중', 5000, 'pending', '2026-08-01'),
      row('u4', 'p-tieA', '먼저', 5000, 'pending', '2026-08-01'),
    ])
    expect(out.participants.map(p => p.participantId)).toEqual(['p-hi', 'p-tieA', 'p-tieB', 'p-low'])
  })
})

describe('buildOrgLedger — latestDate (불변식 5)', () => {
  it('그룹 내 최신 usageDate(Date 파싱 기준)', () => {
    const out = buildOrgLedger([
      row('u1', 'p1', 'A', 1000, 'pending', '2026-08-01'),
      row('u2', 'p1', 'A', 1000, 'pending', '2026-08-15'),
      row('u3', 'p1', 'A', 1000, 'pending', '2026-08-09'),
    ])
    expect(out.participants[0].latestDate).toBe('2026-08-15')
  })
})

describe('buildOrgLedger — 빈 입력 (불변식 6)', () => {
  it('빈 배열 → 0·빈 그룹, byStatus 전부 0(널 아님)', () => {
    const out = buildOrgLedger([])
    expect(out.grandTotal).toBe(0)
    expect(out.totalCount).toBe(0)
    expect(out.participants).toEqual([])
    for (const k of ['pending', 'accepted', 'rejected', 'recovered', 'other'] as const) {
      expect(out.byStatus[k]).toEqual({ amount: 0, count: 0 })
    }
  })
})

describe('buildOrgLedger — 교차 합치성 (불변식 7, 회계 무결성)', () => {
  it('grandTotal == Σ participants.total == Σ byStatus.amount', () => {
    const rows: OrgUsageRow[] = [
      row('u1', 'p1', 'A', 10000, 'pending', '2026-08-01'),
      row('u2', 'p2', 'B', 5000, 'accepted', '2026-08-02'),
      row('u3', 'p2', 'B', 2500, 'rejected', '2026-08-03'),
      row('u4', 'p3', 'C', null, 'recovered', '2026-08-04'),
      row('u5', 'p3', 'C', 750, 'mystery', '2026-08-05'),
    ]
    const out = buildOrgLedger(rows)
    const byParticipant = out.participants.reduce((s, p) => s + p.total, 0)
    const byStatus = Object.values(out.byStatus).reduce((s, b) => s + b.amount, 0)
    expect(out.grandTotal).toBe(18250)
    expect(byParticipant).toBe(out.grandTotal)
    expect(byStatus).toBe(out.grandTotal)
    expect(out.totalCount).toBe(5)
  })
})
