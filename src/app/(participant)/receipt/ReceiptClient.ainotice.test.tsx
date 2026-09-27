import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import { AI_NOTICE_PARTICIPANT } from '@/components/ui/AiNotice'
import ReceiptClient from './ReceiptClient'

/**
 * 지출 기록(당사자) — 영수증 사진 판독(OCR) 자동채움의 생성물 표시 라벨 계약.
 * 판독으로 칸을 채우면 채운 칸 위에 당사자용 AiNotice + '맞는지 봐 주세요' 확인 요청을 보인다.
 * - 판독 전·판독 실패·빈 결과엔 라벨 없음 / 저장 성공(폼 리셋)하면 사라짐 / 새 사진이면 다시 판정.
 * - 라벨은 정적 글: 말로 알리는 채널은 기존 OCR 완료 announce 하나뿐(#191 한 번·한 채널).
 */

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}))
vi.mock('@/app/actions/serviceUsage', () => ({ recordServiceUsage: vi.fn() }))
vi.mock('@/app/actions/activityPhoto', () => ({ addActivityPhotos: vi.fn() }))
vi.mock('@/app/actions/ocr', () => ({ analyzeReceipt: vi.fn() }))
vi.mock('@/app/actions/geocode', () => ({ searchPlaces: vi.fn(async () => []) }))
vi.mock('@/app/actions/serviceProvider', () => ({ findOrCreateProvider: vi.fn(async () => ({ providerId: 'prov-1' })) }))

import { recordServiceUsage } from '@/app/actions/serviceUsage'
import { analyzeReceipt } from '@/app/actions/ocr'
const recordMock = vi.mocked(recordServiceUsage)
const ocrMock = vi.mocked(analyzeReceipt)

// 판독 결과 픽스처 — 실제 반환형은 네 칸(date·amount·store·address)이 다 있는 모양이라 부분 결과는 캐스팅한다.
type OcrResult = Awaited<ReturnType<typeof analyzeReceipt>>
const ocrOk = (data: Record<string, unknown>) => ({ success: true, data }) as unknown as OcrResult
const ocrFail = () => ({ success: false, error: 'x' }) as unknown as OcrResult

const CHECK_PROMPT = '채워진 칸이 맞는지 봐 주세요.'
const OCR_FAIL = '사진에서 내용을 읽지 못했어요. 아래 칸에 직접 입력해 주세요.'

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

function pickReceipt(name = 'receipt.png') {
  fireEvent.change(screen.getByLabelText('영수증 사진'), {
    target: { files: [new File(['x'], name, { type: 'image/png' })] },
  })
}

// setPhoto 가 URL.createObjectURL 을 부른다 → jsdom 미구현이라 스텁.
const origCreate = (URL as unknown as { createObjectURL?: unknown }).createObjectURL
beforeEach(() => {
  refreshMock.mockReset()
  recordMock.mockReset()
  ocrMock.mockReset()
  ;(URL as unknown as { createObjectURL: (f: unknown) => string }).createObjectURL = () => 'blob:stub'
})
afterEach(() => {
  ;(URL as unknown as { createObjectURL?: unknown }).createObjectURL = origCreate
})

describe('ReceiptClient — 판독 자동채움 생성물 표시 라벨', () => {
  it('사진을 고르기 전(판독 전)엔 라벨이 없다', () => {
    renderClient()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.queryByText(CHECK_PROMPT)).toBeNull()
  })

  it('판독으로 칸을 채우면 당사자용 라벨 + 확인 요청이 보이고, 말로는 완료 알림 하나만 읽힌다', async () => {
    ocrMock.mockResolvedValue(ocrOk({ amount: 12000, date: '2026-09-01', store: '카페' }))
    renderClient()
    pickReceipt()

    await waitFor(() => expect(screen.getByLabelText(/얼마 썼어요/)).toHaveValue(12000))
    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent(AI_NOTICE_PARTICIPANT.receipt)
    expect(note).toHaveTextContent(CHECK_PROMPT)
    // 정적 라벨: 라이브 영역 밖 + 전역 status 는 기존 OCR 완료 문구만 담는다(라벨 문구 미포함).
    expect(note.closest('[aria-live]')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('사진에서 내용을 다 읽었어요.')
    expect(screen.getByRole('status')).not.toHaveTextContent(CHECK_PROMPT)
  })

  it('판독 실패면 라벨 없이 직접 입력 안내만 보인다', async () => {
    ocrMock.mockResolvedValue(ocrFail())
    renderClient()
    pickReceipt()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(OCR_FAIL))
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('판독은 됐지만 채운 칸이 없으면(빈 결과) 라벨이 없다', async () => {
    ocrMock.mockResolvedValue(ocrOk({}))
    renderClient()
    pickReceipt()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('사진에서 내용을 다 읽었어요.'))
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('새 사진을 고르면 이전 판독 라벨을 지우고 새 결과로 다시 판정한다', async () => {
    ocrMock.mockResolvedValueOnce(ocrOk({ amount: 12000 }))
    ocrMock.mockResolvedValueOnce(ocrFail())
    renderClient()
    pickReceipt('a.png')
    await screen.findByRole('note')

    pickReceipt('b.png')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(OCR_FAIL))
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('저장에 성공해 폼이 리셋되면 라벨이 사라진다', async () => {
    ocrMock.mockResolvedValue(ocrOk({ amount: 12000, store: '카페' }))
    recordMock.mockResolvedValue({ success: true, usageId: 'u1' } as unknown as Awaited<ReturnType<typeof recordServiceUsage>>)
    renderClient()
    pickReceipt()
    await screen.findByRole('note')

    const submit = screen.getByRole('button', { name: '기록하기' })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect(screen.getByLabelText(/얼마 썼어요/)).toHaveValue(null)
  })
})
