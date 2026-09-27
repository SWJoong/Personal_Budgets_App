import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HelpButton from './HelpButton'

/**
 * P6 Phase C — touch44: HelpButton 기본 버튼 (f13f641 B4 재적용)
 * 출처: feat/kwcag-a11y-foundation f13f641 "콘텐츠 이모지 aria-hidden + 터치타깃 44px (A6-content·B4)" —
 *   #55 이후 main 에 착지하지 못한 조각. 당사자 '더보기' 헤더의 ? 버튼이 'w-8 h-8'(32px) 이라 44px 미달.
 *
 * 단언: 가로·세로 둘 다 44px 터치 크기 클래스(min-h-11/min-w-11 등). 렌더 px 아님. 색 토큰은 대비 sweep 소관.
 *   className prop 을 주면 호출부가 스타일을 책임지므로 기본값만 잠근다.
 */
const TOUCH_H = /(?:^|\s)(?:min-h-11|min-h-\[44px\]|h-11)(?:\s|$)/
const TOUCH_W = /(?:^|\s)(?:min-w-11|min-w-\[44px\]|w-11)(?:\s|$)/

describe('P6-C touch44 — HelpButton 기본 버튼 (helpbutton-default-touch)', () => {
  it('기본 도움말 버튼이 가로·세로 44px 터치 크기 클래스를 가진다', () => {
    render(<HelpButton sectionKey="more" />)
    const btn = screen.getByRole('button', { name: '도움말' })
    expect(btn.className).toMatch(TOUCH_H)
    expect(btn.className).toMatch(TOUCH_W)
    // 옛 32px 고정 크기는 남지 않는다
    expect(btn.className).not.toMatch(/(?:^|\s)(?:w-8|h-8)(?:\s|$)/)
  })
})
