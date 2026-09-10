import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OrgLedgerClient, { type LedgerRow } from './OrgLedgerClient'

/**
 * A4 회계 보강 — 원장 기간 필터 + 참여자별 상태 내역 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A4.
 * 구현 대상: src/app/(supporter)/supporter/transactions/OrgLedgerClient.tsx.
 *
 * 배경: 원장에 정산상태 필터는 있으나 기간(usageDate) 필터가 없고, 참여자 행이 total/count 만 보여
 *   각 참여자의 대기/인정/반려/환수 금액 내역을 알 수 없었다. 기간 from/to 필터(클라이언트)와
 *   참여자별 상태 내역(buildOrgLedger.byStatus)을 붙인다. 서버/액션 무변경.
 *
 * RED 사유: 시작일/종료일 입력이 없고(getByLabelText throw) 참여자 상태 내역('인정' 등)이 안 렌더된다.
 * 단언 범위: 필터 좁힘·내역 렌더만(배치·토큰·정확 문구 제외).
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const rows: LedgerRow[] = [
  {
    id: 'e1',
    participantId: 'p-early',
    participantName: '이른이',
    amount: 1000,
    settlementStatus: 'pending',
    usageDate: '2026-08-01',
    description: '이른 지출',
  },
  {
    id: 'l1',
    participantId: 'p-late',
    participantName: '늦은이',
    amount: 5000,
    settlementStatus: 'accepted',
    usageDate: '2026-09-15',
    description: '늦은 지출',
  },
]

describe('OrgLedgerClient — 기간 필터 + 참여자 상태 내역 (A4)', () => {
  it('시작일을 설정하면 그 이전 지출만 있는 참여자가 사라진다', () => {
    render(<OrgLedgerClient rows={rows} />)
    expect(screen.getByText('이른이')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-09-01' } })
    // 2026-08-01 < 2026-09-01 → 이른이 제외, 늦은이 유지.
    expect(screen.queryByText('이른이')).toBeNull()
    expect(screen.getByText('늦은이')).toBeInTheDocument()
  })

  it('종료일을 설정하면 그 이후 지출만 있는 참여자가 사라진다', () => {
    render(<OrgLedgerClient rows={rows} />)
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-08-31' } })
    expect(screen.getByText('이른이')).toBeInTheDocument()
    expect(screen.queryByText('늦은이')).toBeNull()
  })

  it('참여자 행에 상태별 금액 내역(인정 금액)이 렌더된다', () => {
    render(<OrgLedgerClient rows={rows} />)
    // 늦은이는 accepted 5,000 → 상태 내역에 '인정' 라벨이 보인다(대기만 있는 이른이엔 인정 없음).
    expect(screen.getByText('인정')).toBeInTheDocument()
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0)
  })
})
