import type { SettlementRow } from '@/app/actions/settlement'

/**
 * A6 회계 보강 — 정산 원장 집계 (순수). 골든: src/utils/settlementLedger.test.ts.
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A6.
 *
 * 정산(seoul_settlements)은 participant_id 가 없고 allocation_id 로만 참여자에 묶인다 →
 * allocation→participant 매핑(allocMap)을 받아 참여자별로 그룹핑한다. getSettlements()(RLS 담당분)
 * 전체를 화면에 보존하기 위해, 매핑에 없는 allocation 은 '(알 수 없음)' 으로 폴백한다(데이터 무손실).
 */

export interface AllocationOwner {
  participantId: string
  participantName: string
}

export interface SettlementLedgerTotals {
  accepted: number
  rejected: number
  recovered: number
  unused: number
}

export interface SettlementLedgerParticipant {
  participantId: string
  participantName: string
  settlements: SettlementRow[]
  totals: SettlementLedgerTotals
}

export interface SettlementLedger {
  totals: SettlementLedgerTotals
  participants: SettlementLedgerParticipant[]
}

function emptyTotals(): SettlementLedgerTotals {
  return { accepted: 0, rejected: 0, recovered: 0, unused: 0 }
}

/**
 * 정산 행들을 참여자별로 그룹핑하고 4금액(인정/반려/환수/미사용)을 참여자·전체 totals 로 합산한다.
 * 참여자 순서는 이름 오름차순(localeCompare). 빈 입력 → { totals: 0, participants: [] }.
 */
export function buildSettlementLedger(
  rows: SettlementRow[],
  allocMap: Record<string, AllocationOwner>,
): SettlementLedger {
  const totals = emptyTotals()
  const byParticipant = new Map<string, SettlementLedgerParticipant>()

  for (const row of rows) {
    const owner = allocMap[row.allocation_id] ?? {
      participantId: `unknown:${row.allocation_id}`,
      participantName: '(알 수 없음)',
    }

    let group = byParticipant.get(owner.participantId)
    if (!group) {
      group = {
        participantId: owner.participantId,
        participantName: owner.participantName,
        settlements: [],
        totals: emptyTotals(),
      }
      byParticipant.set(owner.participantId, group)
    }

    group.settlements.push(row)
    group.totals.accepted += row.accepted_amount
    group.totals.rejected += row.rejected_amount
    group.totals.recovered += row.recovered_amount
    group.totals.unused += row.unused_amount

    totals.accepted += row.accepted_amount
    totals.rejected += row.rejected_amount
    totals.recovered += row.recovered_amount
    totals.unused += row.unused_amount
  }

  const participants = [...byParticipant.values()].sort((a, b) =>
    a.participantName.localeCompare(b.participantName),
  )

  return { totals, participants }
}
