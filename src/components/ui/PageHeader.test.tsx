import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PageHeader } from '@/components/ui/PageHeader'

/**
 * PageHeader 프리미티브 RED 계약 — P3 재사용 UI 프리미티브 (W 작성, U 초록화).
 *
 * 감사 동기: `flex h-16 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200`
 *   상단바가 ~51곳(h1 35개 · 뒤로가기 화살표 18개). title / 선택적 back / 우측 action 을 표준화하되
 *   skip-link 타깃(<main id='main-content'>)은 건드리지 않는다.
 *
 * props: title(string) · backHref?(string) · action?(ReactNode).
 * 불변식(행위/시맨틱만 단언 — 토큰·색상·sticky·z-index 단언 금지, 그건 리뷰 몫):
 *   1) <header> 랜드마크(banner) 를 렌더하고 id='main-content' 를 소유하지 않는다
 *      (skip-link 는 헤더를 건너뛰어 각 화면 <main id='main-content'> 로 점프).
 *   2) title 은 단일 level-1 heading → getByRole('heading',{level:1,name:title}).
 *   3) backHref 지정 → 접근성 이름 '뒤로 가기' 링크, href===backHref.
 *   4) backHref 생략 → 뒤로 가기 링크 없음.
 *   5) action 제공 → 헤더 안에 렌더 / 생략 → 없음.
 *
 * RED: '@/components/ui/PageHeader' 미존재 → import 실패로 스위트 전체 RED. U 구현 시 초록.
 */

describe('PageHeader — 상단바 프리미티브 계약', () => {
  it("<header> 랜드마크(banner) 를 렌더하고 id='main-content' 를 가로채지 않는다", () => {
    render(<PageHeader title="김지수님의 예산" />)
    const header = screen.getByRole('banner')
    expect(header.id).not.toBe('main-content')
  })

  it('title 은 단일 level-1 heading 이다', () => {
    render(<PageHeader title="당사자" />)
    expect(screen.getByRole('heading', { level: 1, name: '당사자' })).toBeInTheDocument()
  })

  it("backHref 지정: '뒤로 가기' 링크를 렌더하고 href 가 backHref 와 같다", () => {
    render(<PageHeader title="김지수님의 예산" backHref="/budgets" />)
    const back = screen.getByRole('link', { name: '뒤로 가기' })
    expect(back).toHaveAttribute('href', '/budgets')
  })

  it('backHref 생략: 뒤로 가기 링크가 트리에 없다', () => {
    render(<PageHeader title="당사자" />)
    expect(screen.queryByRole('link', { name: '뒤로 가기' })).not.toBeInTheDocument()
  })

  it('action 제공: 우측 슬롯 내용이 헤더 안에 렌더된다', () => {
    render(<PageHeader title="홈" action={<a href="/more">더보기</a>} />)
    const header = screen.getByRole('banner')
    expect(within(header).getByText('더보기')).toBeInTheDocument()
  })

  it('action 생략: 우측 슬롯 내용이 없다', () => {
    render(<PageHeader title="홈" />)
    expect(screen.queryByText('더보기')).not.toBeInTheDocument()
  })
})
