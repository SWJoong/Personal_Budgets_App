import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '@/components/ui/Card'

/**
 * Card 프리미티브 RED 계약 — P3 재사용 UI 프리미티브 (W 작성, U 초록화).
 *
 * 감사 동기: `p-* rounded-* bg-white ring-1 ring-zinc-200` 표면 블록이 ~84곳,
 *   none-state(bg-zinc-50) · 중첩 inset · hero 반전 · 틴티드 콜아웃(특히 `bg-red-50 border-red-200
 *   text-red-600` 오류배너 23회)까지 제각각. 반경 스케일(xl/2xl/3xl)과 heading 슬롯을 표준화한다.
 *
 * props: as(section|article|div) · variant(default|muted|hero|success|info|warning|danger|neutral) ·
 *   title · headingLevel(2|3) · children.
 * 불변식(행위/시맨틱만 단언 — 토큰·색상 단언 금지):
 *   1) children 을 렌더한다.
 *   2) title 지정 → headingLevel 로 heading 슬롯, 접근성 이름=title → getByRole('heading',{name,level}).
 *   3) title 미지정 → heading 을 주입하지 않는다(유령 heading 금지).
 *   4) 기본 as='section' → 콘텐츠를 감싸는 <section> 을 렌더한다(구조).
 *   5) danger variant 의 문제는 색이 아니라 자식 텍스트로 전달(비색큐).
 *
 * RED: '@/components/ui/Card' 미존재 → import 실패로 스위트 전체 RED. U 구현 시 초록.
 */

describe('Card — 토큰 표면 프리미티브 계약', () => {
  it('children 을 렌더한다', () => {
    render(<Card>본문 내용</Card>)
    expect(screen.getByText('본문 내용')).toBeInTheDocument()
  })

  it("기본 as='section': 콘텐츠를 감싸는 <section> 을 렌더한다", () => {
    const { container } = render(<Card>본문 내용</Card>)
    const section = container.querySelector('section')
    expect(section).not.toBeNull()
    expect(section).toHaveTextContent('본문 내용')
  })

  it('title 지정: 접근성 이름=title 인 heading 슬롯을 렌더한다', () => {
    render(<Card title="예산 봉투">본문</Card>)
    expect(screen.getByRole('heading', { name: '예산 봉투' })).toBeInTheDocument()
  })

  it('title 만 주면 기본 headingLevel=2(h2) 로 렌더한다', () => {
    render(<Card title="영역별 예산">본문</Card>)
    expect(screen.getByRole('heading', { level: 2, name: '영역별 예산' })).toBeInTheDocument()
  })

  it('headingLevel=3: h3 로 렌더한다(문서 개요 순서 유지)', () => {
    render(
      <Card title="요청한 서비스" headingLevel={3}>
        본문
      </Card>
    )
    expect(screen.getByRole('heading', { level: 3, name: '요청한 서비스' })).toBeInTheDocument()
  })

  it('title 생략: heading 을 주입하지 않는다(a11y 트리에 유령 heading 금지)', () => {
    render(<Card>본문만 있어요</Card>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it("danger variant: 문제를 색이 아니라 글자로 전달한다(자식 텍스트가 항상 보인다)", () => {
    render(<Card variant="danger">문제가 있어요</Card>)
    expect(screen.getByText('문제가 있어요')).toBeInTheDocument()
  })
})
