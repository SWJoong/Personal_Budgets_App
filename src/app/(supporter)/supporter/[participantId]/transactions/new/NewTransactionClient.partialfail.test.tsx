import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewTransactionClient from './NewTransactionClient'

/**
 * 계약(W레인): 활동사진 부분실패 안내 + 재기록 잠금 + 5MB 상한 — 실무자 기록화면(§8 ⑦).
 * 구현: src/app/(supporter)/.../transactions/new/NewTransactionClient.tsx
 * addActivityPhotos 반환 { success?, added?, error? } 에서
 *   photoFailed = activityPhotos.length - (added ?? 0)
 * 이 >0 이면 (1)목록 이동 안 함 (2)부분실패 문구 (3)버튼 '나가기' (4)재제출해도 지출 중복기록 안 함.
 * 이 테스트는 구현을 잠그는 회귀 게이트다(테스트 파일만 신설, 구현 미수정).
 */

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))
vi.mock('@/app/actions/serviceUsage', () => ({ recordServiceUsage: vi.fn() }))
vi.mock('@/app/actions/activityPhoto', () => ({ addActivityPhotos: vi.fn() }))

import { recordServiceUsage } from '@/app/actions/serviceUsage'
import { addActivityPhotos } from '@/app/actions/activityPhoto'
const recordMock = vi.mocked(recordServiceUsage)
const addMock = vi.mocked(addActivityPhotos)

const baseProps = {
  participantId: 'p1',
  allocations: [
    { id: 'alloc-1', allocated_amount: 100000, total_ceiling: 100000, starts_on: '2026-01-01', ends_on: '2026-12-31' },
  ],
  domains: [],
  subdomains: [],
}

function twoSmallFiles(): File[] {
  return [
    new File(['a'], 'a.png', { type: 'image/png' }),
    new File(['b'], 'b.png', { type: 'image/png' }),
  ]
}

beforeEach(() => {
  pushMock.mockClear()
  recordMock.mockReset()
  addMock.mockReset()
  recordMock.mockResolvedValue({ success: true, usageId: 'u1' })
})

describe('NewTransactionClient — 활동사진 부분실패(실무자) §8 ⑦', () => {
  it('부분실패(2장 중 1장): 목록 이동 안 함 + 부분실패 문구 + 버튼 "나가기"', async () => {
    addMock.mockResolvedValue({ success: true, added: 1 })
    render(<NewTransactionClient {...baseProps} />)

    fireEvent.change(screen.getByLabelText(/얼마를 썼나요/), { target: { value: '30000' } })
    fireEvent.change(screen.getByLabelText(/활동 사진/), { target: { files: twoSmallFiles() } })
    await waitFor(() => expect(screen.getByText('활동 사진 2장')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '지출 기록하기' }))

    // (b) 부분실패 문구 노출
    await waitFor(() =>
      expect(screen.getByText(/사진 2장 중 1장이 저장되지 않았어요/)).toBeInTheDocument(),
    )
    // (a) 목록 이동 안 함
    expect(pushMock).not.toHaveBeenCalled()
    // (c) 버튼이 '나가기' 로 바뀜
    expect(screen.getByRole('button', { name: '나가기' })).toBeInTheDocument()
    // 지출 자체는 1회만 기록됨
    expect(recordMock).toHaveBeenCalledTimes(1)
  })

  it('부분실패 후 "나가기" 재클릭: 지출 재기록(recordServiceUsage) 안 하고 목록으로만 이동(중복 방지)', async () => {
    addMock.mockResolvedValue({ success: true, added: 1 })
    render(<NewTransactionClient {...baseProps} />)

    fireEvent.change(screen.getByLabelText(/얼마를 썼나요/), { target: { value: '30000' } })
    fireEvent.change(screen.getByLabelText(/활동 사진/), { target: { files: twoSmallFiles() } })
    await waitFor(() => expect(screen.getByText('활동 사진 2장')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '지출 기록하기' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '나가기' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '나가기' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/supporter/p1/transactions'))
    // (d) 중복 방지: 지출 기록은 여전히 1회 (재제출로 늘지 않음)
    expect(recordMock).toHaveBeenCalledTimes(1)
  })

  it('전부실패(2장 중 0장, error 반환): 부분실패로 취급 + 잠금(added undefined 안전 처리)', async () => {
    addMock.mockResolvedValue({ error: '지출 정보를 찾을 수 없어요.' })
    render(<NewTransactionClient {...baseProps} />)

    fireEvent.change(screen.getByLabelText(/얼마를 썼나요/), { target: { value: '30000' } })
    fireEvent.change(screen.getByLabelText(/활동 사진/), { target: { files: twoSmallFiles() } })
    await waitFor(() => expect(screen.getByText('활동 사진 2장')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '지출 기록하기' }))

    await waitFor(() =>
      expect(screen.getByText(/사진 2장 중 2장이 저장되지 않았어요/)).toBeInTheDocument(),
    )
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '나가기' })).toBeInTheDocument()
  })

  it('회귀: 전부 성공(2장)이면 부분실패 문구 없이 목록으로 이동', async () => {
    addMock.mockResolvedValue({ success: true, added: 2 })
    render(<NewTransactionClient {...baseProps} />)

    fireEvent.change(screen.getByLabelText(/얼마를 썼나요/), { target: { value: '30000' } })
    fireEvent.change(screen.getByLabelText(/활동 사진/), { target: { files: twoSmallFiles() } })
    await waitFor(() => expect(screen.getByText('활동 사진 2장')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '지출 기록하기' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/supporter/p1/transactions'))
    expect(screen.queryByText(/저장되지 않았어요/)).toBeNull()
    expect(screen.queryByRole('button', { name: '나가기' })).toBeNull()
  })

  it('회귀: 사진 0장이면 addActivityPhotos 호출 없이 바로 목록으로 이동', async () => {
    render(<NewTransactionClient {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/얼마를 썼나요/), { target: { value: '30000' } })
    fireEvent.click(screen.getByRole('button', { name: '지출 기록하기' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/supporter/p1/transactions'))
    expect(addMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/저장되지 않았어요/)).toBeNull()
  })

  it('5MB 초과 필터: 큰 파일은 빼고 담긴 개수·초과 개수를 안내', async () => {
    render(<NewTransactionClient {...baseProps} />)
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    const small = new File(['s'], 'small.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/활동 사진/), { target: { files: [big, small] } })

    await waitFor(() => expect(screen.getByText('활동 사진 1장')).toBeInTheDocument())
    expect(screen.getByText(/사진 1장은 5MB가 넘어 빼놓았어요/)).toBeInTheDocument()
  })
})
