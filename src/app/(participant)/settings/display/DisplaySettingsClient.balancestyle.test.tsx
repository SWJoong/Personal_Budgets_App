import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DisplaySettingsClient from './DisplaySettingsClient'
import { DEFAULT_PREFERENCES } from '@/utils/uiPreferences'

/**
 * 화면 설정 — 잔액 위젯 모양 선택 계약 (W 레인). 목표: 당사자 인지 접근성(F0) — 고를 수 있어야 반영됨.
 * 설계: Plan&Source/goala_balance_widget_roleswitch_W.md §1-2.
 *
 * 배경: 현재 이 화면은 홈 블록 토글만 있고 balance_widget_style(pie/water/cash/emoji/text)을 고를 UI 가
 *   없다(값은 보존만). 당사자가 자기에게 쉬운 잔액 모양을 고를 수 있게 5스타일 선택을 추가한다.
 *
 * RED 사유: 스타일 선택 UI 가 아직 없다(라디오군·저장 호출 부재).
 */

const saveMock = vi.fn()
vi.mock('@/app/actions/preferences', () => ({
  saveUIPreferences: (...a: unknown[]) => saveMock(...a),
}))

beforeEach(() => {
  saveMock.mockReset()
  saveMock.mockResolvedValue({ success: true })
})
afterEach(() => cleanup())

describe('DisplaySettings — 잔액 위젯 모양 선택', () => {
  it('5가지 모양(파이·물컵·현금·이모지·글자)을 라디오로 보여준다', () => {
    render(<DisplaySettingsClient participantId="p-1" initial={DEFAULT_PREFERENCES} />)
    expect(screen.getByRole('radio', { name: /파이|동그라미|원/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /물컵|컵|물/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /현금|돈|지폐/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /이모지|그림/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /글자|숫자|텍스트/ })).toBeInTheDocument()
  })

  it('현재 설정(pie)이 선택 상태로 표시된다', () => {
    render(<DisplaySettingsClient participantId="p-1" initial={{ ...DEFAULT_PREFERENCES, balance_widget_style: 'pie' }} />)
    expect(screen.getByRole('radio', { name: /파이|동그라미|원/ })).toBeChecked()
  })

  it('다른 모양을 고르면 saveUIPreferences 가 그 스타일로 호출된다', async () => {
    const user = userEvent.setup()
    render(<DisplaySettingsClient participantId="p-1" initial={{ ...DEFAULT_PREFERENCES, balance_widget_style: 'pie' }} />)
    await user.click(screen.getByRole('radio', { name: /물컵|컵|물/ }))
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ balance_widget_style: 'water' }),
      ),
    )
  })
})
