import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinkButton } from '@/components/ui/LinkButton'

/**
 * LinkButton 스모크 — U 구현 최소검증(정식 계약 아님, 통합 PR 에서 W 리뷰).
 * Button 의 형제로 <a>/next-link 렌더 + href + 접근성 이름 + variant/size 토큰 parity(buttonStyles 공유).
 */

describe('LinkButton — 링크형 액션 프리미티브 스모크', () => {
  it('<a> 링크로 렌더하고 href·children 접근성 이름을 갖는다', () => {
    render(<LinkButton href="/plan">계획 보러 가기</LinkButton>)
    const link = screen.getByRole('link', { name: '계획 보러 가기' })
    expect(link).toHaveAttribute('href', '/plan')
  })

  it('iconOnly: aria-label 로 접근성 이름을 갖는다', () => {
    render(
      <LinkButton href="/more" iconOnly aria-label="더보기">
        ⚙
      </LinkButton>
    )
    expect(screen.getByRole('link', { name: '더보기' })).toBeInTheDocument()
  })

  it('variant 를 바꿔도 링크 접근성 이름(글자)은 그대로 유지된다', () => {
    const { unmount } = render(
      <LinkButton href="/x" variant="secondary">
        지출 적기
      </LinkButton>
    )
    expect(screen.getByRole('link', { name: '지출 적기' })).toBeInTheDocument()
    unmount()
  })
})
