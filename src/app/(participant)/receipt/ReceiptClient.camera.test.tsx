import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import ReceiptClient from './ReceiptClient'

/**
 * 당사자 QA 요청 — 지출 기록('내가 쓴 돈 적기') 진입 시 영수증 카메라를 바로 연다(접근성).
 * 구현 대상: src/app/(participant)/receipt/ReceiptClient.tsx (마운트 시 영수증 사진 입력 auto-click).
 *
 * 배경: 발달장애인 당사자는 폼을 읽고 채우기보다 사진 → OCR 자동채움 흐름이 인지부담이 적다. 영수증
 *   사진 입력은 이미 capture="environment"(카메라 우선)라, 진입 즉시 그 입력을 클릭해 카메라를 연다.
 *   ★브라우저 사용자활성화 정책상 실제 카메라가 안 열릴 수 있으나(그 경우 사용자가 '영수증 사진'을 탭),
 *   실패해도 무해(폼은 그대로). 이 계약은 "마운트 시 영수증(capture) 입력이 클릭된다"만 잠근다.
 *
 * RED 사유: 현재 마운트 시 auto-click 이 없다 → 클릭 안 됨. U 가 useEffect 로 fileInputRef.click() 추가하면 초록.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/actions/serviceUsage', () => ({ recordServiceUsage: vi.fn() }))
vi.mock('@/app/actions/activityPhoto', () => ({ addActivityPhotos: vi.fn() }))
vi.mock('@/app/actions/ocr', () => ({ analyzeReceipt: vi.fn(async () => ({ success: true, data: {} })) }))
vi.mock('@/app/actions/geocode', () => ({ searchPlaces: vi.fn(async () => []) }))
vi.mock('@/app/actions/serviceProvider', () => ({ findOrCreateProvider: vi.fn(async () => ({ providerId: 'prov-1' })) }))

const baseProps = {
  participantId: 'p1',
  allocationId: 'alloc-1',
  requestedServices: [],
  usages: [],
  remaining: 50000,
  spendingRules: [],
}

describe('ReceiptClient — 진입 시 영수증 카메라 자동 열기 (당사자 QA)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('마운트 시 영수증 사진 입력(capture=environment)이 자동으로 클릭된다', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click')
    render(
      <LiveRegionProvider>
        <ReceiptClient {...baseProps} />
      </LiveRegionProvider>,
    )
    // 자동 클릭된 입력들 중 하나가 capture=environment(영수증 카메라)여야 한다.
    const cameraAutoOpened = clickSpy.mock.contexts.some(
      (ctx) => (ctx as HTMLInputElement | undefined)?.getAttribute?.('capture') === 'environment',
    )
    expect(cameraAutoOpened).toBe(true)
    clickSpy.mockRestore()
  })
})
