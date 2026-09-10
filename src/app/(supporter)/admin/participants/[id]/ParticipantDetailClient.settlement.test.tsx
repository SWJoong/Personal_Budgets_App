import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ParticipantDetailClient from './ParticipantDetailClient'
import { recordSettlement } from '@/app/actions/settlement'

/**
 * A1 회계 보강 — 정산 등록 폼이 반려/환수 금액을 수집한다 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A1.
 *
 * 배경: recordSettlement/SettlementInput 은 이미 rejectedAmount·recoveredAmount 를 받아 저장하고
 *   (settlement.ts:13-14,38-39), 정산 표시도 4개(인정·반려·환수·미사용)를 다 보여준다
 *   (ParticipantDetailClient.tsx:277). 그러나 **등록 폼**은 정산기간·인정·미사용만 수집한다
 *   (상태 59-61 · 핸들러 88-114 · JSX 286-313) → 반려·환수를 UI 로 기록할 방법이 없다.
 *
 * RED 사유(현재 실패):
 *   (1) '반려 금액'·'환수 금액' placeholder input 이 없다 → getByPlaceholderText throw.
 *   (2) handleAddSettlement 이 rejectedAmount/recoveredAmount 를 recordSettlement 로 넘기지 않는다.
 *   U 가 두 state + input 2개를 추가하고 호출에 배선하면(unusedAmount 패턴 복제) 초록.
 *
 * 단언 범위: 행위만(입력 존재·전달 값). 배치·문구 정확표기·토큰·색은 단언하지 않는다
 *   (기존 b4 계약과 동일 원칙). allocationId 를 세팅해야 폼이 렌더된다(!allocationId → 안내문구).
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/app/actions/monitoring', () => ({ recordMonitoring: vi.fn() }))
vi.mock('@/app/actions/settlement', () => ({
  recordSettlement: vi.fn(async () => ({ success: true, settlementId: 's-1' })),
}))
vi.mock('@/app/actions/appeal', () => ({
  decideAppeal: vi.fn(),
  recordAppealDueDate: vi.fn(),
}))

function renderDetail() {
  return render(
    <ParticipantDetailClient
      participantId="p-42"
      allocationId="alloc-1"
      allocatedAmount={500000}
      copayAmount={null}
      copayStatus={null}
      monitoringRecords={[]}
      settlements={[]}
      appeals={[]}
    />,
  )
}

describe('A1 — 정산 등록 폼 반려/환수 수집', () => {
  it('배정이 있으면 반려 금액·환수 금액 입력이 렌더된다', () => {
    renderDetail()
    // RED: 현재 폼에 두 입력이 없다 → throw
    expect(screen.getByPlaceholderText('반려 금액')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('환수 금액')).toBeInTheDocument()
  })

  it('정산 등록 시 반려·환수 금액이 recordSettlement 로 숫자로 전달된다', async () => {
    renderDetail()
    fireEvent.change(screen.getByPlaceholderText('정산 기간 (예: 2025-01~2025-06)'), {
      target: { value: '2025-01~2025-06' },
    })
    fireEvent.change(screen.getByPlaceholderText('인정 금액'), { target: { value: '100000' } })
    fireEvent.change(screen.getByPlaceholderText('반려 금액'), { target: { value: '5000' } })
    fireEvent.change(screen.getByPlaceholderText('환수 금액'), { target: { value: '3000' } })
    fireEvent.change(screen.getByPlaceholderText('미사용 금액'), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: '정산 등록' }))

    await waitFor(() => expect(recordSettlement).toHaveBeenCalledTimes(1))
    // 인정·미사용(기존)에 더해 반려·환수(신규)가 숫자로 함께 전달돼야 한다.
    expect(recordSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        allocationId: 'alloc-1',
        settledPeriod: '2025-01~2025-06',
        acceptedAmount: 100000,
        rejectedAmount: 5000,
        recoveredAmount: 3000,
        unusedAmount: 2000,
      }),
    )
  })
})
