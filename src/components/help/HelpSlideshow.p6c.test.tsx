import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HelpSlideshow from './HelpSlideshow'
import { HELP_SECTIONS } from '@/data/helpSlides'

/**
 * P6 Phase C — touch44 + 장식 이모지: HelpSlideshow (f13f641 B4·A6-content 재적용)
 * 출처: feat/kwcag-a11y-foundation f13f641 — Modal 리팩터(#58) 뒤 main 에 다시 들어오지 못한 조각.
 *
 * - 닫기 ✕: aria-label='닫기' 는 이미 green, 크기가 글자 크기뿐(44px 미달) → 44px 터치 클래스.
 * - 슬라이드 큰 아이콘: 제목·본문 바로 위 장식 → aria-hidden(스크린리더가 "돈 가방" 등으로 읽지 않게).
 *
 * ★Esc/오버레이/포커스/scroll-lock 은 Modal.test.tsx 소유 → 재작성 금지. 색 토큰 단언 없음.
 */
const TOUCH_H = /(?:^|\s)(?:min-h-11|min-h-\[44px\]|h-11)(?:\s|$)/
const TOUCH_W = /(?:^|\s)(?:min-w-11|min-w-\[44px\]|w-11)(?:\s|$)/
const section = HELP_SECTIONS.home

describe('P6-C touch44 — HelpSlideshow 닫기 버튼 (helpslideshow-close-touch)', () => {
  it('✕ 닫기 버튼이 가로·세로 44px 터치 크기 클래스를 가진다', () => {
    render(<HelpSlideshow section={section} onClose={() => {}} />)
    const close = screen.getByRole('button', { name: '닫기' })
    expect(close.className).toMatch(TOUCH_H)
    expect(close.className).toMatch(TOUCH_W)
  })
})

describe('P6-C 장식 이모지 — HelpSlideshow 슬라이드 아이콘 (helpslideshow-icon-hidden)', () => {
  it('현재 슬라이드의 큰 아이콘은 aria-hidden 이다', () => {
    render(<HelpSlideshow section={section} onClose={() => {}} />)
    const icon = screen.getByText(section.slides[0].icon)
    expect(icon.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
