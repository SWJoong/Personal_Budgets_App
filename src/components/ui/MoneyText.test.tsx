import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MoneyText } from '@/components/ui/MoneyText'

/**
 * MoneyText 프리미티브 RED 계약 — P3 재사용 UI 프리미티브 (W 작성, U 초록화).
 *
 * 감사 동기: 지역적으로 재정의된 won() 헬퍼 16개 + ko-KR 포맷 호출부 17곳,
 *   그리고 반올림 분기(OrgLedgerClient/transactions 계열은 Math.round vs 비반올림)가 갈려 있다.
 *   정본 렌더러 1개로 통일 — 공유 src/utils/budget-visuals.formatCurrency 를 단일 진실원천으로 위임하고
 *   '원' 접미사 + 정규 반올림을 강제한다.
 *
 * props: value(number) · emphasis(hero|body|muted) · sign(expense|income|none) · onHero.
 * 불변식(행위/출력 텍스트만 단언 — 토큰·색상 단언 금지):
 *   1) ko-KR 그룹화 정수 + '원' 접미사 → getByText('3,000원').
 *   2) 정규 반올림(Math.round): value=1499.6 → '1,500원'(비반올림 호출부 봉인).
 *   3) sign='expense' → 색이 아닌 글자 단서(선행 '−' 또는 '지출' 단어)로 지출을 표시(고대비 대비).
 *
 * RED: '@/components/ui/MoneyText' 미존재 → import 실패로 스위트 전체 RED. U 구현 시 초록.
 */

describe('MoneyText — 금액 렌더러 프리미티브 계약', () => {
  it("ko-KR 그룹화 정수 + '원' 접미사로 렌더한다", () => {
    render(<MoneyText value={3000} />)
    expect(screen.getByText('3,000원')).toBeInTheDocument()
  })

  it('큰 금액도 천단위 구분 + 원 접미사', () => {
    render(<MoneyText value={1234567} />)
    expect(screen.getByText('1,234,567원')).toBeInTheDocument()
  })

  it('정규 반올림(Math.round): 1499.6 → 1,500원(비반올림 호출부 봉인)', () => {
    render(<MoneyText value={1499.6} />)
    expect(screen.getByText('1,500원')).toBeInTheDocument()
  })

  it("sign='expense': 색이 아닌 글자 단서(−/지출)로 지출을 표시한다", () => {
    const { container } = render(<MoneyText value={3000} sign="expense" />)
    const text = container.textContent ?? ''
    expect(text).toContain('3,000원')
    // 색만이 아니라 글자 단서(부호/단어)가 함께 있어야 고대비 모드에서 지출을 구분할 수 있다.
    expect(text).toMatch(/지출|[-−]/)
  })
})
