import { describe, it, expect } from 'vitest'
import { buildSettlementLedger, type AllocationOwner } from './settlementLedger'
import type { SettlementRow } from '@/app/actions/settlement'

/**
 * A6 회계 보강 — 정산 원장 집계 골든 (W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A6.
 * 구현 대상: src/utils/settlementLedger.ts (buildSettlementLedger 신규 순수 함수).
 *
 * 배경: 정산 열람이 관리자 참여자 상세 안에만 있어, 실무자가 담당 참여자 정산(인정/반려/환수/미사용)을
 *   한 화면에서 못 봤다. getSettlements()(RLS 담당분)를 참여자별로 묶는 순수 집계를 골든으로 잠근다.
 *   정산은 allocation_id 로만 참여자에 묶이므로 allocation→participant 매핑을 받는다.
 *
 * 불변식: (1) allocation→participant 그룹핑(같은 참여자 다건 배정 합침) (2) 참여자 totals = 4금액 합,
 *   전체 totals = Σ 참여자 (3) 매핑에 없는 allocation → '(알 수 없음)'(데이터 무손실) (4) 빈 입력 → 0·빈
 *   (5) 참여자 이름 오름차순.
 *
 * RED 사유: buildSettlementLedger 가 없다 → import 실패.
 */

let seq = 0
function srow(over: Partial<SettlementRow> = {}): SettlementRow {
  return {
    id: `s-${seq++}`,
    allocation_id: 'a-1',
    settled_period: '2026-01~2026-06',
    accepted_amount: 0,
    rejected_amount: 0,
    recovered_amount: 0,
    unused_amount: 0,
    note: null,
    settled_on: '2026-07-01',
    ...over,
  }
}

const map: Record<string, AllocationOwner> = {
  'a-1': { participantId: 'p1', participantName: '김지수' },
  'a-2': { participantId: 'p1', participantName: '김지수' },
  'a-3': { participantId: 'p2', participantName: '이철수' },
}

describe('buildSettlementLedger (A6)', () => {
  it('allocation→participant 로 그룹, 같은 참여자의 다건 배정은 합쳐진다', () => {
    const out = buildSettlementLedger(
      [
        srow({ allocation_id: 'a-1', accepted_amount: 10000 }),
        srow({ allocation_id: 'a-2', accepted_amount: 5000 }),
        srow({ allocation_id: 'a-3', accepted_amount: 3000 }),
      ],
      map,
    )
    expect(out.participants).toHaveLength(2)
    const p1 = out.participants.find((p) => p.participantId === 'p1')!
    expect(p1.settlements).toHaveLength(2)
    expect(p1.totals.accepted).toBe(15000)
  })

  it('참여자 totals = 4금액 합 · 전체 totals == Σ 참여자', () => {
    const out = buildSettlementLedger(
      [
        srow({ allocation_id: 'a-1', accepted_amount: 10000, rejected_amount: 1000, recovered_amount: 500, unused_amount: 200 }),
        srow({ allocation_id: 'a-3', accepted_amount: 3000, unused_amount: 100 }),
      ],
      map,
    )
    const p1 = out.participants.find((p) => p.participantId === 'p1')!
    expect(p1.totals).toEqual({ accepted: 10000, rejected: 1000, recovered: 500, unused: 200 })
    expect(out.totals.accepted).toBe(13000)
    expect(out.totals.unused).toBe(300)
  })

  it('매핑에 없는 allocation 은 (알 수 없음) 으로(데이터 무손실)', () => {
    const out = buildSettlementLedger([srow({ allocation_id: 'a-ghost', accepted_amount: 700 })], map)
    expect(out.participants).toHaveLength(1)
    expect(out.participants[0].participantName).toBe('(알 수 없음)')
    expect(out.totals.accepted).toBe(700)
  })

  it('빈 입력 → totals 0 · 빈 그룹', () => {
    const out = buildSettlementLedger([], map)
    expect(out.participants).toEqual([])
    expect(out.totals).toEqual({ accepted: 0, rejected: 0, recovered: 0, unused: 0 })
  })

  it('참여자는 이름 오름차순', () => {
    const out = buildSettlementLedger([srow({ allocation_id: 'a-3' }), srow({ allocation_id: 'a-1' })], map)
    expect(out.participants.map((p) => p.participantName)).toEqual(['김지수', '이철수'])
  })
})
