import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrgLedgerClient, { type LedgerRow } from './OrgLedgerClient'

/**
 * P6 Phase C — list GUARD: 이미 ul/li 인 client 목록 회귀락
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §list (contract list.green.client-lists.guard)
 *
 * ★거짓 RED 금지 — OrgLedgerClient 는 이미 당사자 그룹을 <ul>/<li> 로 렌더(line100/105).
 * 접힘 기본값이라 내부 거래 <ul> 은 미표시 → 외부 당사자 li 수 == 고유 participantId 수.
 * 이 GUARD 는 나중 리팩터가 list 시맨틱을 깨뜨리면 트립한다.
 */
const rows: LedgerRow[] = [
  { id: 'r1', participantId: 'p1', participantName: '김철수', amount: 10000, settlementStatus: 'pending', usageDate: '2026-09-01', description: '간식' },
  { id: 'r2', participantId: 'p1', participantName: '김철수', amount: 20000, settlementStatus: 'accepted', usageDate: '2026-09-02', description: '교통' },
  { id: 'r3', participantId: 'p2', participantName: '이영희', amount: 5000, settlementStatus: 'pending', usageDate: '2026-09-03', description: '문구' },
]

describe('P6-C list GUARD — OrgLedgerClient (org-ledger-list)', () => {
  it('당사자 그룹이 list/listitem 으로 렌더된다(고유 2명)', () => {
    render(<OrgLedgerClient rows={rows} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    // 접힘 기본값 → 외부 당사자 li 만(내부 거래 ul 미표시)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
