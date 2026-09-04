import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FaqButton from './FaqButton'

/**
 * P6 Phase C — touch44: FaqButton 모달 닫기 버튼 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §touch-label (contract touch-label.faqbutton.close-touch)
 *
 * 닫기 버튼은 aria-label='닫기' 로 라벨은 이미 green 이나 className 이 'w-8 h-8'(32×32px)
 * 이라 44px 터치 영역 미달. FaqButton 은 순수 client(FAQ_ITEMS 정적) → 렌더 가능.
 * components/ui 이지만 P3 프리미티브가 아닌 기능 컴포넌트라 touch44 대상.
 *
 * 단언: 터치 크기 클래스 문자열 존재(min-h-11|w-11 등). 렌더 px 아님. 색 토큰은 대비 sweep 소관.
 */
describe('P6-C touch44 — FaqButton 닫기 버튼 (faqbutton-close-touch)', () => {
  it('[RED] 모달 닫기 버튼이 44px 터치 크기 클래스를 가진다', async () => {
    const user = userEvent.setup()
    render(<FaqButton variant="inline" />)

    await user.click(screen.getByRole('button', { name: '자주 묻는 질문' }))
    const close = await screen.findByRole('button', { name: '닫기' })

    // RED: 현재 className 이 'w-8 h-8'(32px) — 최소 터치 크기 클래스 없음
    expect(close.className).toMatch(/min-h-11|min-w-11|min-h-\[44px\]|min-w-\[44px\]|w-11|h-11/)
  })
})
