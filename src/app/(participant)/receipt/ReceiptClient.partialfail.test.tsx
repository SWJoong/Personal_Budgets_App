import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import ReceiptClient from './ReceiptClient'

/**
 * 계약(W레인): 활동사진 부분실패 안내 + 5MB 상한 — 당사자 기록화면(§8 ⑦).
 * 구현: src/app/(participant)/receipt/ReceiptClient.tsx
 * 당사자는 폼 리셋+router.refresh 라 재제출 잠금(실무자 savedUsageId)이 없다 — 대신 부분실패 시
 * setError + announce(assertive) 로 알린다. 정상(전부 성공)은 조용히 refresh(회귀 없음).
 * 테스트 파일만 신설, 구현 미수정.
 */

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}))
vi.mock('@/app/actions/serviceUsage', () => ({ recordServiceUsage: vi.fn() }))
vi.mock('@/app/actions/activityPhoto', () => ({ addActivityPhotos: vi.fn() }))
vi.mock('@/app/actions/ocr', () => ({ analyzeReceipt: vi.fn(async () => ({ success: true, data: {} })) }))
vi.mock('@/app/actions/geocode', () => ({ searchPlaces: vi.fn(async () => []) }))
vi.mock('@/app/actions/serviceProvider', () => ({ findOrCreateProvider: vi.fn(async () => ({ providerId: 'prov-1' })) }))

import { recordServiceUsage } from '@/app/actions/serviceUsage'
import { addActivityPhotos } from '@/app/actions/activityPhoto'
const recordMock = vi.mocked(recordServiceUsage)
const addMock = vi.mocked(addActivityPhotos)

const baseProps = {
  participantId: 'p1',
  allocationId: 'alloc-1',
  requestedServices: [],
  usages: [],
  remaining: 50000,
  spendingRules: [],
}

function renderClient() {
  return render(
    <LiveRegionProvider>
      <ReceiptClient {...baseProps} />
    </LiveRegionProvider>,
  )
}

function twoSmallFiles(): File[] {
  return [
    new File(['a'], 'a.png', { type: 'image/png' }),
    new File(['b'], 'b.png', { type: 'image/png' }),
  ]
}

async function fillAndAttach(files: File[]) {
  fireEvent.change(screen.getByLabelText(/활동 사진/), { target: { files } })
  await waitFor(() =>
    expect(screen.getByText(`활동 사진 ${files.length}장을 담았어요.`)).toBeInTheDocument(),
  )
  fireEvent.change(screen.getByLabelText(/얼마 썼어요/), { target: { value: '5000' } })
}

function submit() {
  const form = screen.getByRole('button', { name: '기록하기' }).closest('form') as HTMLFormElement
  fireEvent.submit(form)
}

beforeEach(() => {
  refreshMock.mockClear()
  recordMock.mockReset()
  addMock.mockReset()
  recordMock.mockResolvedValue({ success: true, usageId: 'u1' })
})

describe('ReceiptClient — 활동사진 부분실패(당사자) §8 ⑦', () => {
  it('부분실패(2장 중 1장): 부분실패 문구가 assertive 라이브영역(role=alert)에 도달', async () => {
    addMock.mockResolvedValue({ success: true, added: 1 })
    renderClient()
    await fillAndAttach(twoSmallFiles())
    submit()

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.some((n) => n.textContent?.includes('사진 1장이 안 올라갔어요'))).toBe(true)
    })
    // 완전한 문구(지출 저장 안내 포함)가 노출된다 — 보이는 오류상자 + 라이브영역 양쪽(2개)
    expect(screen.getAllByText('지출은 저장했어요. 그런데 사진 1장이 안 올라갔어요.').length).toBeGreaterThan(0)
  })

  it('전부실패(2장 중 0장, error 반환): 2장 안 올라갔다고 안내(added undefined 안전 처리)', async () => {
    addMock.mockResolvedValue({ error: '지출 정보를 찾을 수 없어요.' })
    renderClient()
    await fillAndAttach(twoSmallFiles())
    submit()

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.some((n) => n.textContent?.includes('사진 2장이 안 올라갔어요'))).toBe(true)
    })
  })

  it('회귀: 전부 성공(2장)이면 부분실패 문구 없이 조용히 refresh', async () => {
    addMock.mockResolvedValue({ success: true, added: 2 })
    renderClient()
    await fillAndAttach(twoSmallFiles())
    submit()

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    expect(screen.queryByText(/안 올라갔어요/)).toBeNull()
  })

  it('회귀: 사진 0장이면 addActivityPhotos 호출 없이 refresh, 문구 없음', async () => {
    renderClient()
    fireEvent.change(screen.getByLabelText(/얼마 썼어요/), { target: { value: '5000' } })
    submit()

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    expect(addMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/안 올라갔어요/)).toBeNull()
  })

  it('5MB 초과 필터: 큰 파일은 빼고 assertive 로 안내', async () => {
    renderClient()
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    const small = new File(['s'], 'small.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/활동 사진/), { target: { files: [big, small] } })

    await waitFor(() => expect(screen.getByText('활동 사진 1장을 담았어요.')).toBeInTheDocument())
    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((n) => n.textContent?.includes('사진 1장은 너무 커서 뺐어요'))).toBe(true)
  })
})
