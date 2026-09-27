import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import ReceiptClient from './ReceiptClient'

/**
 * 계약: 지출 기록 성공 안내 — 당사자 기록화면(P2 a11y).
 * 구현: src/app/(participant)/receipt/ReceiptClient.tsx (handleSubmit 성공 분기 + 성공 상자)
 *
 * 결함(옛 코드): 다 저장되면(영수증 경고 없음·사진 실패 0) 폼만 비우고 router.refresh — 아무것도 읽거나
 * 보여주지 않아 스크린리더 사용자도, 폼이 비는 것만 본 당사자도 저장됐는지 모른다.
 * 정본(#191 규칙): 결과마다 안내는 **한 채널로 한 번**.
 *   - 성공 → 전역 LiveRegion polite(role=status) 에 '지출을 기록했어요.' 한 번 + 보이는 성공 상자(라이브 영역 아님).
 *   - 같은 성공을 또 하면 announce 가 새 노드(key=seq)로 다시 넣어 다시 읽힌다.
 *   - 부분성공(영수증 경고 / 사진 실패)은 assertive 한 번 + 보이는 오류상자 — 성공 안내는 붙지 않는다.
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

const SUCCESS = '지출을 기록했어요.'

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

function amountInput() {
  return screen.getByLabelText(/얼마 썼어요/) as HTMLInputElement
}

// 앞선 기록의 전환(useTransition)이 끝나 버튼이 '기록하기'로 돌아온 뒤에 낸다 — 결과 문구는 전환 종료보다
// 먼저 커밋되므로, 문구만 보고 바로 내면 버튼이 아직 '저장하고 있어요...'(disabled)라 흔들린다.
async function submit() {
  const button = await screen.findByRole('button', { name: '기록하기' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.submit(button.closest('form') as HTMLFormElement)
}

// 전역 LiveRegion 두 영역(Provider 가 상시 마운트). 폼 안 FormField 오류(role=alert)와 구분하려고 aria-live 로 고른다.
function politeRegion() {
  return screen.getAllByRole('status').find((n) => n.getAttribute('aria-live') === 'polite')!
}
function assertiveRegion() {
  return screen.getAllByRole('alert').find((n) => n.getAttribute('aria-live') === 'assertive')!
}

// 보조기기가 스스로 읽는 영역 전부 — 메시지가 몇 채널로 나가는지 센다.
function liveRegionsWith(text: string) {
  return Array.from(document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')).filter(
    (n) => n.textContent?.includes(text),
  )
}

// 보이는 성공 상자 = 라이브 영역 밖에 있는 성공 문구.
function visibleSuccess() {
  return screen
    .queryAllByText(SUCCESS)
    .find((n) => !n.closest('[aria-live], [role="status"], [role="alert"], [role="log"]')) ?? null
}

function twoSmallFiles(): File[] {
  return [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]
}

async function attachActivityPhotos(files: File[]) {
  fireEvent.change(screen.getByLabelText(/활동 사진/), { target: { files } })
  await waitFor(() => expect(screen.getByText(`활동 사진 ${files.length}장을 담았어요.`)).toBeInTheDocument())
}

beforeEach(() => {
  refreshMock.mockClear()
  recordMock.mockReset()
  addMock.mockReset()
  recordMock.mockResolvedValue({ success: true, usageId: 'u1' })
})

describe('ReceiptClient — 지출 기록 성공 안내(당사자) P2 a11y', () => {
  it('다 저장되면 polite(role=status) 에 성공 문구가 한 번만 도달하고, 보이는 성공 상자가 뜬다', async () => {
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()

    await waitFor(() => expect(politeRegion()).toHaveTextContent(SUCCESS))
    expect(refreshMock).toHaveBeenCalledTimes(1)
    // 한 채널 = 전역 polite 영역 하나에만 있다(보이는 상자·assertive 에 겹치지 않음).
    expect(liveRegionsWith(SUCCESS)).toHaveLength(1)
    expect(liveRegionsWith(SUCCESS)[0]).toBe(politeRegion())
    expect(assertiveRegion()).toHaveTextContent('')
    // 눈으로 보는 당사자용 성공 상자(라이브 영역 아님).
    expect(visibleSuccess()).not.toBeNull()
    // 폼은 비워진다(다음 기록 준비).
    expect(amountInput().value).toBe('')
  })

  it('두 번 연달아 기록하면 같은 문구라도 새 노드로 다시 넣어 다시 읽힌다', async () => {
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()
    await waitFor(() => expect(politeRegion()).toHaveTextContent(SUCCESS))
    const firstNode = politeRegion().firstElementChild
    expect(firstNode).not.toBeNull()

    recordMock.mockResolvedValue({ success: true, usageId: 'u2' })
    fireEvent.change(amountInput(), { target: { value: '3000' } })
    await submit()

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(politeRegion().firstElementChild).not.toBe(firstNode))
    expect(politeRegion()).toHaveTextContent(SUCCESS)
    expect(politeRegion().children).toHaveLength(1)
    expect(liveRegionsWith(SUCCESS)).toHaveLength(1)
    expect(visibleSuccess()).not.toBeNull()
  })

  it('새 기록을 시작하면(금액을 고치면) 보이는 성공 상자가 사라진다', async () => {
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()
    await waitFor(() => expect(visibleSuccess()).not.toBeNull())

    fireEvent.change(amountInput(), { target: { value: '1000' } })
    expect(visibleSuccess()).toBeNull()
  })

  it('새 기록을 시작하면(내용을 고치면) 보이는 성공 상자가 사라진다', async () => {
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()
    await waitFor(() => expect(visibleSuccess()).not.toBeNull())

    fireEvent.change(screen.getByLabelText('무엇에 썼어요?'), { target: { value: '카페' } })
    expect(visibleSuccess()).toBeNull()
  })

  it('성공 뒤 빈 폼을 또 내서 오류가 뜨면 성공 상자는 사라진다', async () => {
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()
    await waitFor(() => expect(visibleSuccess()).not.toBeNull())

    await submit() // 금액이 비어 있음 → 금액 오류
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true')
    expect(visibleSuccess()).toBeNull()
  })

  it('성공하면 전에 떠 있던 오류는 지운다', async () => {
    recordMock.mockResolvedValueOnce({ error: '이미 기록된 지출이에요.' })
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()
    await waitFor(() => expect(screen.getAllByText('이미 기록된 지출이에요.').length).toBeGreaterThan(0))
    expect(visibleSuccess()).toBeNull()

    await submit() // 폼이 유지돼 있어 그대로 다시 시도 → 이번엔 성공
    await waitFor(() => expect(politeRegion()).toHaveTextContent(SUCCESS))
    expect(visibleSuccess()).not.toBeNull()
    // 보이는 오류상자는 사라졌다(assertive 영역에 남은 지난 알림 노드는 다시 읽히지 않는다).
    expect(
      screen.queryAllByText('이미 기록된 지출이에요.').filter((n) => !n.closest('[aria-live]')),
    ).toHaveLength(0)
  })

  it('영수증 경고(지출은 저장됨+영수증 실패)는 assertive 한 번만 — 성공 안내는 없다', async () => {
    const WARN = '지출은 기록됐지만 영수증 저장에 실패했어요: storage 5xx'
    recordMock.mockResolvedValue({ success: true, usageId: 'u1', error: WARN })
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()

    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(WARN))
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(liveRegionsWith(WARN)).toHaveLength(1)
    expect(liveRegionsWith(SUCCESS)).toHaveLength(0)
    expect(politeRegion()).not.toHaveTextContent(SUCCESS)
    expect(visibleSuccess()).toBeNull()
  })

  it('활동사진 일부 실패는 assertive 한 번만 — 성공 안내는 없다', async () => {
    const PARTIAL = '지출은 저장했어요. 그런데 사진 1장이 안 올라갔어요.'
    addMock.mockResolvedValue({ success: true, added: 1 })
    renderClient()
    await attachActivityPhotos(twoSmallFiles())
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()

    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(PARTIAL))
    expect(liveRegionsWith(PARTIAL)).toHaveLength(1)
    expect(liveRegionsWith(SUCCESS)).toHaveLength(0)
    expect(politeRegion()).not.toHaveTextContent(SUCCESS)
    expect(visibleSuccess()).toBeNull()
  })

  it('활동사진까지 다 올라가면 성공 안내가 한 번 도달한다', async () => {
    addMock.mockResolvedValue({ success: true, added: 2 })
    renderClient()
    await attachActivityPhotos(twoSmallFiles())
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()

    await waitFor(() => expect(politeRegion()).toHaveTextContent(SUCCESS))
    expect(addMock).toHaveBeenCalledTimes(1)
    expect(liveRegionsWith(SUCCESS)).toHaveLength(1)
    expect(assertiveRegion()).toHaveTextContent('')
    expect(visibleSuccess()).not.toBeNull()
  })

  it('지출이 저장 안 되면(usageId 없음) 성공 안내 없이 assertive 오류만', async () => {
    recordMock.mockResolvedValue({ error: '이미 기록된 지출이에요.' })
    renderClient()
    fireEvent.change(amountInput(), { target: { value: '5000' } })
    await submit()

    await waitFor(() => expect(assertiveRegion()).toHaveTextContent('이미 기록된 지출이에요.'))
    expect(liveRegionsWith(SUCCESS)).toHaveLength(0)
    expect(visibleSuccess()).toBeNull()
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
