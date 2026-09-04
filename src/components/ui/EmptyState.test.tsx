import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * EmptyState 프리미티브 RED 계약 — P3 재사용 UI 프리미티브 (W 작성, U 초록화).
 *
 * 감사 동기: '아직 …없어요' 빈 상태 문구가 ~57개, 시각 래퍼 ~14종(전체화면 중앙정렬 형 + 인라인
 *   muted-card 형)으로 흩어져 있고 다음 행동(G5) 안내가 제각각. 한 프리미티브로 통일한다.
 *
 * props: emoji?(장식, aria-hidden) · title · description? · action?({label,href} 또는 노드) ·
 *   variant(full|inline).
 * 불변식(행위/시맨틱만 단언 — 토큰·색상 단언 금지):
 *   1) title 을, description 이 있으면 description 도 렌더 → getByText 로 둘 다 해석.
 *   2) emoji 제공 시 aria-hidden(의미는 글자에, 글리프에 두지 않음).
 *   3) action 제공 → 접근 가능한 컨트롤 getByRole('link',{name:label}), href===action.href.
 *   4) action 생략 → CTA 컨트롤 없음.
 *
 * RED: '@/components/ui/EmptyState' 미존재 → import 실패로 스위트 전체 RED. U 구현 시 초록.
 */

describe('EmptyState — 빈 상태 프리미티브 계약', () => {
  it('title 과 description(있을 때) 을 렌더한다', () => {
    render(<EmptyState title="아직 쓴 돈이 없어요" description="여기에 쓴 돈이 보여요" />)
    expect(screen.getByText('아직 쓴 돈이 없어요')).toBeInTheDocument()
    expect(screen.getByText('여기에 쓴 돈이 보여요')).toBeInTheDocument()
  })

  it('description 생략: 설명 텍스트가 없다', () => {
    render(<EmptyState title="아직 없어요" />)
    expect(screen.queryByText('여기에 쓴 돈이 보여요')).not.toBeInTheDocument()
  })

  it('emoji 제공 시 aria-hidden(의미는 글자에 있다)', () => {
    render(<EmptyState emoji="💰" title="아직 계획이 없어요" />)
    const emoji = screen.getByText('💰')
    expect(emoji.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('action 제공: 접근 가능한 CTA(link) 를 렌더하고 href 가 action.href 와 같다', () => {
    render(
      <EmptyState
        title="아직 계획이 없어요"
        action={{ label: '계획 보러 가기', href: '/plan' }}
      />
    )
    const cta = screen.getByRole('link', { name: '계획 보러 가기' })
    expect(cta).toHaveAttribute('href', '/plan')
  })

  it('action 생략: CTA 컨트롤(link/button)이 트리에 없다', () => {
    render(<EmptyState title="아직 등록된 당사자가 없어요" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
