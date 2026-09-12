import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import BalanceWidget from './BalanceWidget'
import type { BalanceWidgetStyle } from '@/utils/uiPreferences'

/**
 * 당사자 시각 잔액 위젯 계약 (W 레인). 목표: 당사자 인지 접근성 복원(F0).
 * 설계: Plan&Source/goala_balance_widget_roleswitch_W.md §1.
 * 구현: src/components/home/BalanceWidget.tsx.
 *
 * 배경: 화면 설정의 balance_widget_style(pie·water·cash·emoji·text)이 홈에 반영되지 않아(리빌드 회귀)
 *   당사자가 고른 모양이 안 나온다. 이 위젯이 스타일별로 잔액을 시각+텍스트로 보여준다.
 *
 * ★인지·SR 원칙: 정보는 그래픽 '모양·색'만으로 전달하지 않는다 — 라벨·금액·비율을 **텍스트로도**
 *   반드시 노출하고, 장식 그래픽은 aria-hidden. 다양한 장애유형(지적·시각) 공통 접근.
 *
 * RED 사유: BalanceWidget 이 아직 없다.
 */

const STYLES: BalanceWidgetStyle[] = ['pie', 'water', 'cash', 'emoji', 'text']
// 남은 500,000 / 전체 2,000,000 = 25% (반올림 모호성 없는 픽스처).
const P = { remaining: 500000, total: 2000000, spent: 1500000 }

afterEach(() => cleanup())

describe('BalanceWidget — 시각 잔액 위젯(F0 복원)', () => {
  it.each(STYLES)('스타일 %s: 라벨·금액·남은비율을 텍스트로 노출한다', (style) => {
    render(<BalanceWidget {...P} style={style} emoji="🪙" />)
    // 라벨(쉬운 말)
    expect(screen.getByText(/지금 쓸 수 있는 돈/)).toBeInTheDocument()
    // 금액(MoneyText → 500,000원)
    expect(screen.getByText(/500,000/)).toBeInTheDocument()
    // 남은 비율(모양만이 아니라 숫자로도) — 25%
    expect(screen.getByText(/25\s*%/)).toBeInTheDocument()
  })

  it('접근성: 위젯 전체가 라벨+금액+비율을 담은 하나의 접근 이름(role=img)로 요약된다', () => {
    render(<BalanceWidget {...P} style="pie" emoji="🪙" />)
    const fig = screen.getByRole('img')
    const name = fig.getAttribute('aria-label') || ''
    expect(name).toMatch(/지금 쓸 수 있는 돈/)
    expect(name).toMatch(/500,000|50만/)
    expect(name).toMatch(/25\s*%|전체의/)
  })

  it('pie/water/cash 는 장식 그래픽(SVG 등)을 aria-hidden 으로 둔다(정보는 텍스트가 담당)', () => {
    for (const style of ['pie', 'water', 'cash'] as BalanceWidgetStyle[]) {
      const { container } = render(<BalanceWidget {...P} style={style} emoji="🪙" />)
      // 장식 그래픽 요소가 존재하고 aria-hidden 이다.
      const decorative = container.querySelector('[aria-hidden="true"]')
      expect(decorative, `${style} 장식 그래픽 aria-hidden`).toBeTruthy()
      cleanup()
    }
  })

  it('emoji 스타일은 고른 이모지를 쓴다', () => {
    render(<BalanceWidget {...P} style="emoji" emoji="🐢" />)
    expect(screen.getByText(/🐢/)).toBeInTheDocument()
  })

  it('잔액 0원(다 씀)도 안전하게 렌더된다(0% · 나눗셈 방어)', () => {
    render(<BalanceWidget remaining={0} total={2000000} spent={2000000} style="pie" emoji="🪙" />)
    expect(screen.getByText(/0\s*%/)).toBeInTheDocument()
    expect(screen.getByText(/지금 쓸 수 있는 돈/)).toBeInTheDocument()
  })

  it('total 0 이어도 나눗셈 오류 없이 렌더된다(방어)', () => {
    render(<BalanceWidget remaining={0} total={0} spent={0} style="text" emoji="🪙" />)
    expect(screen.getByText(/지금 쓸 수 있는 돈/)).toBeInTheDocument()
  })
})
