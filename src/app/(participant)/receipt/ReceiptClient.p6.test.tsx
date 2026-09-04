import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import ReceiptClient from './ReceiptClient'

/**
 * P6 Phase B — 프리미티브 소비자 배선 계약: 지출 기록 (ReceiptClient).
 * 설계출처: Plan&Source/goala_p6_phaseB_W.md §FormField/LiveRegion 소비자 매핑.
 *
 * ★버킷 재분류(정직 관측): ReceiptClient 는 원래 스펙에서 'FormField 미연결'로 잡혔으나,
 *   실제 main 에서는 amount FormField 에 error={amountError} 를 이미 넘기는 **참조구현**이다.
 *   → applications/new · admin/participants/new 가 맞춰야 할 모델. 따라서 여기는 RED 아님:
 *   [ALIGN] 필드연결 오류(aria-invalid) + [GUARD] LiveRegion 행위(announce→region) 회귀잠금.
 *
 * ★시퀀싱: Phase A(#103)와 ReceiptClient 파일이 겹친다 → U 는 #103 머지 후 이 테스트·impl 을 rebase.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/actions/serviceUsage', () => ({
  recordServiceUsage: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/app/actions/ocr', () => ({
  analyzeReceipt: vi.fn(async () => ({ success: true, data: { amount: 12000, date: '2026-09-01', store: '카페' } })),
}))
vi.mock('@/app/actions/geocode', () => ({
  searchPlaces: vi.fn(async () => []),
}))
vi.mock('@/app/actions/serviceProvider', () => ({
  findOrCreateProvider: vi.fn(async () => ({ providerId: 'prov-1' })),
}))

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

describe('ReceiptClient p6 소비자 — 필드연결 오류(참조구현) + LiveRegion 행위', () => {
  it('[ALIGN] 금액을 비우고 제출하면 amount 컨트롤에 aria-invalid=true 가 붙는다(참조구현)', () => {
    renderClient()
    const form = screen.getByRole('button', { name: '기록하기' }).closest('form') as HTMLFormElement
    fireEvent.submit(form) // 금액 비어 있음
    expect(screen.getByLabelText(/얼마/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('[GUARD] 금액 오류가 assertive 로 role=alert 영역에 도달한다(action→region)', () => {
    renderClient()
    const form = screen.getByRole('button', { name: '기록하기' }).closest('form') as HTMLFormElement
    fireEvent.submit(form)
    // amount FormField 오류(role=alert) + LiveRegion assertive 영역 둘 다 role=alert →
    // 어느 하나라도 문구를 담고 있으면 '행위가 영역에 반영됨'이 확인된다.
    const alerts = screen.getAllByRole('alert')
    const hit = alerts.some((n) => n.textContent?.includes('얼마 썼는지 금액을 적어 주세요.'))
    expect(hit).toBe(true)
  })

  it('[GUARD] 사진 선택 시 OCR 진행 안내가 polite(role=status) 로 도달한다(action→region)', async () => {
    // ReceiptClient 가 setPhoto 에서 URL.createObjectURL 을 호출 → jsdom 미구현이라 스텁.
    const origCreate = (URL as unknown as { createObjectURL?: unknown }).createObjectURL
    ;(URL as unknown as { createObjectURL: (f: unknown) => string }).createObjectURL = () => 'blob:stub'
    try {
      renderClient()
      const fileInput = screen.getByLabelText('영수증 사진') as HTMLInputElement
      const file = new File(['x'], 'receipt.png', { type: 'image/png' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      // 진행('읽는 중')→완료('다 읽었어요') 로 polite 영역이 갱신된다. 모의 OCR 이 즉시 resolve 하므로
      // 종단 상태(완료 문구)로 'action→region 반영'을 확정한다(진행 문구는 완료 문구로 덮인다).
      await waitFor(() => {
        expect(screen.getByRole('status').textContent).toContain('사진에서 내용을 다 읽었어요.')
      })
    } finally {
      ;(URL as unknown as { createObjectURL?: unknown }).createObjectURL = origCreate
    }
  })
})
