import { describe, it, expect } from 'vitest'
import { buildOrgLedger, type OrgUsageRow } from './orgLedger'

/**
 * A4 회계 보강 — 참여자별 지출상태 내역(byStatus) 골든 (W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A4.
 * 구현 대상: src/utils/orgLedger.ts (OrgLedgerParticipant 에 byStatus 가산).
 *
 * 배경: 원장이 참여자별 total/count 만 보여줘, 각 참여자의 지출이 대기/인정/반려/환수로 얼마씩인지
 *   알 수 없었다. buildOrgLedger 가 참여자마다 상태버킷 금액·건수(byStatus)를 함께 집계하도록 확장.
 *
 * 불변식(가산): (1) 참여자 byStatus 는 org byStatus 와 같은 5버킷(pending/accepted/rejected/
 *   recovered/other) (2) 참여자 Σ byStatus.amount == participant.total, Σ count == participant.count
 *   (3) 미지 상태 → other (4) null amount → 0(건수 포함) (5) org byStatus == Σ 참여자 byStatus.
 *
 * RED 사유: 현재 OrgLedgerParticipant 에 byStatus 필드가 없다 → 접근 시 undefined → 단언 실패.
 *   기존 orgLedger.test.ts 는 필드단위 단언이라 이 필드 추가로 깨지지 않는다(가산).
 */

let seq = 0
function row(
  participantId: string,
  amount: number | null,
  settlementStatus: string,
  usageDate = '2026-09-01',
): OrgUsageRow {
  return {
    id: `u-${seq++}`,
    participantId,
    participantName: participantId.toUpperCase(),
    amount,
    settlementStatus,
    usageDate,
  }
}

describe('buildOrgLedger — 참여자별 byStatus (A4)', () => {
  it('참여자별로 상태 버킷 금액·건수를 집계한다', () => {
    const out = buildOrgLedger([
      row('p1', 1000, 'pending'),
      row('p1', 2000, 'accepted'),
      row('p1', 500, 'rejected'),
      row('p2', 3000, 'accepted'),
    ])
    const p1 = out.participants.find((p) => p.participantId === 'p1')!
    expect(p1.byStatus.pending).toEqual({ amount: 1000, count: 1 })
    expect(p1.byStatus.accepted).toEqual({ amount: 2000, count: 1 })
    expect(p1.byStatus.rejected).toEqual({ amount: 500, count: 1 })
    expect(p1.byStatus.recovered).toEqual({ amount: 0, count: 0 })
    const p2 = out.participants.find((p) => p.participantId === 'p2')!
    expect(p2.byStatus.accepted).toEqual({ amount: 3000, count: 1 })
  })

  it('참여자 byStatus 합 == 참여자 total·count(교차 합치)', () => {
    const out = buildOrgLedger([
      row('p1', 1000, 'pending'),
      row('p1', 2000, 'accepted'),
      row('p1', 4000, 'recovered'),
    ])
    const p1 = out.participants[0]
    const sumAmt = Object.values(p1.byStatus).reduce((s, b) => s + b.amount, 0)
    const sumCnt = Object.values(p1.byStatus).reduce((s, b) => s + b.count, 0)
    expect(sumAmt).toBe(p1.total)
    expect(sumCnt).toBe(p1.count)
  })

  it('미지 상태는 참여자 byStatus.other 로(누락 금지)', () => {
    const out = buildOrgLedger([row('p1', 700, 'weird_status')])
    expect(out.participants[0].byStatus.other).toEqual({ amount: 700, count: 1 })
  })

  it('null amount → 0(건수엔 포함), 참여자별에도 적용', () => {
    const out = buildOrgLedger([row('p1', null, 'pending')])
    expect(out.participants[0].byStatus.pending).toEqual({ amount: 0, count: 1 })
  })

  it('org byStatus == Σ 참여자 byStatus (층 합치)', () => {
    const out = buildOrgLedger([
      row('p1', 1000, 'pending'),
      row('p2', 2000, 'pending'),
      row('p2', 3000, 'accepted'),
    ])
    const sumPending = out.participants.reduce((s, p) => s + p.byStatus.pending.amount, 0)
    expect(sumPending).toBe(out.byStatus.pending.amount)
    const sumAccepted = out.participants.reduce((s, p) => s + p.byStatus.accepted.amount, 0)
    expect(sumAccepted).toBe(out.byStatus.accepted.amount)
  })
})
