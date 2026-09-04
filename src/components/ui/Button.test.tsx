import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

/**
 * Button 프리미티브 RED 계약 — P3 재사용 UI 프리미티브 (W 작성, U 초록화).
 *
 * 감사 동기: `bg-zinc-900 text-white … min-h-[44px] rounded-xl … disabled:opacity-50` 형태의
 *   손수 만든 primary 버튼이 ~39곳, 승인/조건부승인/반려 결정 3종 세트가 화면마다 재정의됨.
 *   터치타깃·hover·disabled·focus-visible·비색큐 loading 상태를 한 곳에 구워 팔레트·상태 하드코딩을 없앤다.
 *
 * props: variant(primary|secondary|ghost|danger|positive|warning) · size(sm|md) ·
 *   loading · iconOnly · 그 외 표준 button 속성 위임.
 * 불변식(행위/ARIA 만 단언 — 토큰·className·색상은 단언하지 않음. 그건 eslint jsx-a11y +
 *   tokenFoundation fs-scan + 코드리뷰 몫):
 *   1) 실제 <button> 으로 렌더, children 이 접근성 이름 → getByRole('button',{name}).
 *   2) 기본 type='button'(제출 아님) — .type==='button'.
 *   3) disabled → disabled 속성 + 클릭해도 onClick 미호출.
 *   4) loading → aria-busy='true' + 비대화(클릭 무시) + 보이는 글자 라벨 유지(색/투명도만으로 상태표시 금지).
 *   5) 활성 클릭 → onClick 정확히 1회.
 *   6) iconOnly → aria-label 로 비어있지 않은 접근성 이름 강제.
 *
 * RED: '@/components/ui/Button' 미존재 → import 실패로 스위트 전체 RED(tsc TS2307 + vitest + build).
 *   U 가 §Button 계약대로 구현하면 초록.
 */

describe('Button — 인터랙티브 컨트롤 프리미티브 계약', () => {
  it('실제 <button> 을 렌더하고 children 이 접근성 이름이 된다', () => {
    render(<Button>저장하기</Button>)
    const btn = screen.getByRole('button', { name: '저장하기' })
    expect(btn.tagName).toBe('BUTTON')
  })

  it("기본 type='button' — 명시 type 미전달 시 폼 실수 제출을 막는다", () => {
    render(<Button>저장하기</Button>)
    const btn = screen.getByRole('button', { name: '저장하기' }) as HTMLButtonElement
    expect(btn.type).toBe('button')
  })

  it('활성 클릭: onClick 이 클릭당 정확히 1회 호출된다', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>제출하기</Button>)
    await user.click(screen.getByRole('button', { name: '제출하기' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled: disabled 속성을 갖고, 클릭해도 onClick 을 호출하지 않는다', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button disabled onClick={onClick}>
        제출하기
      </Button>
    )
    const btn = screen.getByRole('button', { name: '제출하기' })
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('loading: aria-busy=true + 비대화(클릭 무시) + 보이는 글자 라벨 유지(색/투명도만 금지)', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button loading onClick={onClick}>
        저장하기
      </Button>
    )
    const btn = screen.getByRole('button', { name: /저장하기/ })
    expect(btn).toHaveAttribute('aria-busy', 'true')
    await user.click(btn)
    expect(onClick).not.toHaveBeenCalled()
    // 상태가 색/투명도(스피너 색)만이 아니라 글자로도 남아있어야 한다.
    expect(screen.getByText('저장하기')).toBeInTheDocument()
  })

  it('iconOnly: 아이콘 전용이어도 접근성 이름(aria-label)이 비어있지 않다', () => {
    render(
      <Button iconOnly aria-label="더보기">
        ⚙
      </Button>
    )
    expect(screen.getByRole('button', { name: '더보기' })).toBeInTheDocument()
  })

  it('variant 를 바꿔도 접근성 이름(글자 라벨)은 그대로 유지된다', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'positive', 'warning'] as const
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>승인</Button>)
      expect(screen.getByRole('button', { name: '승인' })).toBeInTheDocument()
      unmount()
    }
  })
})
