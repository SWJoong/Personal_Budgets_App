import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SettlementsLedgerClient from './SettlementsLedgerClient'
import { buildSettlementLedger } from '@/utils/settlementLedger'
import type { SettlementRow } from '@/app/actions/settlement'

/**
 * A6 회계 보강 — 실무자 정산 원장 렌더 계약 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A6.
 * 구현 대상: src/app/(supporter)/supporter/settlements/SettlementsLedgerClient.tsx.
 *
 * 배경: 실무자가 담당 참여자 정산(인정/반려/환수/미사용)을 한 화면에서 열람하는 전용 라우트. 표시
 *   금액은 정본 MoneyText(§8·§9 통일 준수). 이 계약은 4금액이 MoneyText 로 렌더됨과 빈 상태를 잠근다.
 *
 * RED 사유: SettlementsLedgerClient·buildSettlementLedger 가 아직 없다 → import 실패.
 * 단언 범위: 금액 렌더(MoneyText)·참여자명·빈 상태만. 배치·문구 정확표기는 단언 안 함.
 */

function srow(over: Partial<SettlementRow> = {}): SettlementRow {
  return {
    id: 's-1',
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

const ledger = buildSettlementLedger(
  [srow({ accepted_amount: 10000, rejected_amount: 2000, recovered_amount: 1500, unused_amount: 800 })],
  { 'a-1': { participantId: 'p1', participantName: '김지수' } },
)

describe('SettlementsLedgerClient — 정산 원장 렌더 (A6)', () => {
  it('참여자 그룹에 인정/반려/환수/미사용 금액이 MoneyText 로 렌더된다', () => {
    render(<SettlementsLedgerClient ledger={ledger} />)
    expect(screen.getByText('김지수')).toBeInTheDocument()
    const accepted = screen.getAllByText('10,000원')
    expect(accepted.length).toBeGreaterThan(0)
    expect(accepted[0]).toHaveClass('tabular-nums') // MoneyText 를 거쳤음
    expect(screen.getAllByText('2,000원').length).toBeGreaterThan(0) // 반려
    expect(screen.getAllByText('1,500원').length).toBeGreaterThan(0) // 환수
    expect(screen.getAllByText('800원').length).toBeGreaterThan(0) // 미사용
  })

  it('정산이 없으면 참여자 그룹이 없다(빈 상태)', () => {
    const empty = buildSettlementLedger([], {})
    render(<SettlementsLedgerClient ledger={empty} />)
    expect(screen.queryByText('김지수')).toBeNull()
  })
})
