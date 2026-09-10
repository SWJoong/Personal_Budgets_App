import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TransactionEditClient from './TransactionEditClient'
import { updateServiceUsage, deleteServiceUsage } from '@/app/actions/serviceUsage'

/**
 * A2 회계 보강 — 거래 상세의 수정/삭제 어포던스 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A2.
 * 구현 대상: src/app/(supporter)/supporter/transactions/[id]/TransactionEditClient.tsx (신규 클라이언트).
 *
 * 배경: 거래 상세(page.tsx)는 "편집은 이번 스코프 밖(열람 전용)"이었다. 서버컴포넌트가 이미
 *   settlement_status 를 읽으므로 canEdit=(pending) 과 초기값을 prop 으로 넘겨 이 클라이언트가
 *   수정 폼 + 삭제를 담당한다.
 *
 * 정책: pending 일 때만 수정/삭제 컨트롤을 노출한다(검토 끝나면 안내만). 서버 액션도 재검증하므로
 *   UI 는 1차 차단, 액션이 2차 강제(serviceUsage.mutate.test.ts).
 *
 * RED 사유: TransactionEditClient 가 아직 없다 → import 실패로 전체 RED.
 * 단언 범위: 노출/미노출·액션 배선만. 배치·토큰·문구 정확표기는 단언하지 않는다.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/app/actions/serviceUsage', () => ({
  updateServiceUsage: vi.fn(async () => ({ success: true })),
  deleteServiceUsage: vi.fn(async () => ({ success: true })),
}))

const initial = { amount: 12000, usageDate: '2026-09-01', description: '간식' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('A2 — TransactionEditClient 수정/삭제 어포던스', () => {
  it('pending(canEdit) 이면 금액 프리필 입력과 삭제 버튼이 노출된다', () => {
    render(<TransactionEditClient usageId="u-1" participantId="p-1" canEdit initial={initial} />)
    // 금액이 프리필된 입력 — 반전 시(열람전용) 부재 → RED
    expect(screen.getByDisplayValue('12000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
  })

  it('검토가 끝나(!canEdit) 면 수정 폼·삭제 버튼이 노출되지 않는다', () => {
    render(<TransactionEditClient usageId="u-1" participantId="p-1" canEdit={false} initial={initial} />)
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull()
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull()
  })

  it('저장을 누르면 변경 값으로 updateServiceUsage 가 호출된다', async () => {
    render(<TransactionEditClient usageId="u-1" participantId="p-1" canEdit initial={initial} />)
    fireEvent.change(screen.getByDisplayValue('12000'), { target: { value: '9000' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(updateServiceUsage).toHaveBeenCalledTimes(1))
    expect(updateServiceUsage).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ amount: 9000 }),
    )
  })

  it('삭제를 확인하면 deleteServiceUsage 가 호출된다', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TransactionEditClient usageId="u-1" participantId="p-1" canEdit initial={initial} />)
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(deleteServiceUsage).toHaveBeenCalledWith('u-1'))
    confirmSpy.mockRestore()
  })
})
