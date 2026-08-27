import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveRegionProvider, useToast } from '@/components/ui/LiveRegion'

/**
 * LiveRegion / useToast 프리미티브 RED 계약 — KRDS/KWCAG (W 작성, U 초록화).
 *
 * 감사 결과 앱에 aria-live/role=status/role=alert 가 0건 → 폼 오류·저장 상태·OCR 진행이 스크린리더에 무음.
 * 계약:
 *   - Provider 는 앱 루트에 polite(role=status) · assertive(role=alert) 라이브 영역 1쌍을 **비어 있어도 상시 마운트**한다.
 *     (동적 삽입을 보조기기가 읽으려면 영역이 announce 이전부터 DOM 에 있어야 한다.)
 *   - useToast().announce(msg, politeness?) : politeness 기본 'polite'. 'polite'→status, 'assertive'→alert 영역에 메시지 노출.
 *
 * RED: '@/components/ui/LiveRegion' 미존재 → import 실패로 스위트 RED. U 가 구현하면 초록.
 */

function Consumer() {
  const { announce } = useToast()
  return (
    <>
      <button onClick={() => announce('저장했어요')}>공손 알림</button>
      <button onClick={() => announce('문제가 있어요', 'assertive')}>긴급 알림</button>
    </>
  )
}

describe('LiveRegion / useToast — 라이브 영역 계약', () => {
  it('Provider 는 polite(status)·assertive(alert) 영역을 비어 있어도 상시 마운트한다', () => {
    render(
      <LiveRegionProvider>
        <div>본문</div>
      </LiveRegionProvider>
    )
    // announce 이전부터 두 영역이 DOM 에 존재해야 한다.
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it("announce(msg) 는 기본 polite → status 영역에 노출(alert 아님)", async () => {
    const user = userEvent.setup()
    render(
      <LiveRegionProvider>
        <Consumer />
      </LiveRegionProvider>
    )
    await user.click(screen.getByRole('button', { name: '공손 알림' }))

    expect(within(screen.getByRole('status')).getByText('저장했어요')).toBeInTheDocument()
    expect(within(screen.getByRole('alert')).queryByText('저장했어요')).not.toBeInTheDocument()
  })

  it("announce(msg, 'assertive') 는 alert 영역에 노출된다", async () => {
    const user = userEvent.setup()
    render(
      <LiveRegionProvider>
        <Consumer />
      </LiveRegionProvider>
    )
    await user.click(screen.getByRole('button', { name: '긴급 알림' }))

    expect(within(screen.getByRole('alert')).getByText('문제가 있어요')).toBeInTheDocument()
  })

  it('polite 영역은 aria-live=polite 로 동작한다(role=status 암시값 또는 명시)', () => {
    render(
      <LiveRegionProvider>
        <div />
      </LiveRegionProvider>
    )
    const status = screen.getByRole('status')
    const live = status.getAttribute('aria-live')
    // role=status 는 aria-live=polite 를 암시 → 미지정이거나 'polite' 여야 하고, 'assertive' 면 안 된다.
    expect(live === null || live === 'polite').toBe(true)
  })
})
