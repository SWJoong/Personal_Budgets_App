import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OrgLedgerClient, { type LedgerRow } from './OrgLedgerClient'

/**
 * A5 회계 보강 — 원장 영역 필터 + CSV export 링크 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A5.
 * 구현 대상: src/app/(supporter)/supporter/transactions/OrgLedgerClient.tsx.
 *
 * 배경: A4 에서 연기한 영역 필터를, export 가 필요로 하는 영역 라벨 배선과 함께 붙인다. LedgerRow 에
 *   domainLabel(선택 필드)이 실려 오고, 원장은 영역 드롭다운으로 거른다. export 는 Route Handler
 *   (/api/export/transactions)로 사용자 브라우저가 내려받는다(plain <a> — next/link 아님).
 *
 * RED 사유: 영역 필터(getByLabelText('영역'))·export 링크가 아직 없다.
 * 단언 범위: 영역 필터 좁힘·export 링크 href 만. 배치·문구·다운로드 동작 자체는 단언 안 함.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const rows: LedgerRow[] = [
  {
    id: 'a1',
    participantId: 'p-a',
    participantName: '일상이',
    amount: 1000,
    settlementStatus: 'pending',
    usageDate: '2026-09-01',
    description: '지출A',
    domainLabel: '일상생활',
  },
  {
    id: 'b1',
    participantId: 'p-b',
    participantName: '건강이',
    amount: 2000,
    settlementStatus: 'accepted',
    usageDate: '2026-09-02',
    description: '지출B',
    domainLabel: '건강',
  },
]

describe('OrgLedgerClient — 영역 필터 + CSV export (A5)', () => {
  it('영역을 고르면 그 영역이 아닌 참여자가 사라진다', () => {
    render(<OrgLedgerClient rows={rows} />)
    expect(screen.getByText('일상이')).toBeInTheDocument()
    expect(screen.getByText('건강이')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('영역'), { target: { value: '건강' } })
    expect(screen.queryByText('일상이')).toBeNull()
    expect(screen.getByText('건강이')).toBeInTheDocument()
  })

  it('CSV 내려받기 링크가 /api/export/transactions 로 존재한다(필터 없으면 파라미터 없음)', () => {
    render(<OrgLedgerClient rows={rows} />)
    const link = screen.getByRole('link', { name: /CSV|내려받기|내보내기/ })
    expect(link).toHaveAttribute('href', '/api/export/transactions')
  })

  // 관리자 QA #2: 거래장부 CSV 내려받기를 당사자별로도 거를 수 있어야 한다.
  it('당사자를 고르면 그 당사자가 아닌 행이 사라진다', () => {
    render(<OrgLedgerClient rows={rows} />)
    expect(screen.getByText('일상이')).toBeInTheDocument()
    expect(screen.getByText('건강이')).toBeInTheDocument()
    // 당사자 필터 select(옵션 value = participantId).
    fireEvent.change(screen.getByLabelText('당사자'), { target: { value: 'p-b' } })
    expect(screen.queryByText('일상이')).toBeNull()
    expect(screen.getByText('건강이')).toBeInTheDocument()
  })

  it('당사자를 고르면 CSV 내려받기 링크가 그 당사자로 필터된다', () => {
    render(<OrgLedgerClient rows={rows} />)
    fireEvent.change(screen.getByLabelText('당사자'), { target: { value: 'p-b' } })
    const link = screen.getByRole('link', { name: /CSV|내려받기|내보내기/ })
    expect(link.getAttribute('href')).toContain('participant=p-b')
  })
})
