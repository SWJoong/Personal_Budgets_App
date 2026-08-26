import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormField } from '@/components/ui/FormField'

/**
 * FormField 프리미티브 RED 계약 — KRDS/KWCAG 폼 접근성 (W 작성, U 초록화).
 *
 * 감사 결과 주 플로우(ReceiptClient 등)에 label 연결·aria-invalid·aria-describedby·required 시맨틱이 0건.
 * 계약 (render-prop 로 임의 컨트롤 래핑):
 *   <FormField id label required error help>{(field) => <input {...field} />}</FormField>
 *   field = { id, 'aria-required'?, 'aria-invalid'?, 'aria-describedby'? }
 *   - 보이는 <label htmlFor={id}> 를 항상 렌더(플레이스홀더로 대체 금지) → getByLabelText 로 컨트롤을 찾을 수 있다.
 *   - required → aria-required="true".
 *   - error → aria-invalid="true" + role=alert 오류문 + aria-describedby 가 그 오류문 id 를 포함.
 *   - help → aria-describedby 가 도움말 id 를 포함(오류와 공존 시 둘 다 포함).
 *
 * RED: '@/components/ui/FormField' 미존재 → import 실패로 스위트 RED. U 가 구현하면 초록.
 */

describe('FormField — 폼 필드 접근성 계약', () => {
  it('보이는 label 을 컨트롤과 연결한다(플레이스홀더 대체 금지)', () => {
    render(
      <FormField id="name" label="이름">
        {(field) => <input type="text" placeholder="예: 홍길동" {...field} />}
      </FormField>
    )
    // 플레이스홀더가 있어도 프로그래매틱 label 로 컨트롤을 찾을 수 있어야 한다.
    const input = screen.getByLabelText(/이름/)
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('required → 컨트롤에 aria-required=true', () => {
    render(
      <FormField id="amount" label="금액" required>
        {(field) => <input type="number" {...field} />}
      </FormField>
    )
    expect(screen.getByLabelText(/금액/)).toHaveAttribute('aria-required', 'true')
  })

  it('오류 없음: aria-invalid 가 켜지지 않고 role=alert 도 없다', () => {
    render(
      <FormField id="memo" label="메모">
        {(field) => <input type="text" {...field} />}
      </FormField>
    )
    const input = screen.getByLabelText(/메모/)
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('error → aria-invalid=true + role=alert 오류문 + aria-describedby 가 오류문을 가리킨다', () => {
    render(
      <FormField id="name" label="이름" error="이름을 입력해요">
        {(field) => <input type="text" {...field} />}
      </FormField>
    )
    const input = screen.getByLabelText(/이름/)
    expect(input).toHaveAttribute('aria-invalid', 'true')

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('이름을 입력해요')

    const describedby = input.getAttribute('aria-describedby') ?? ''
    expect(alert.id).not.toBe('')
    expect(describedby.split(/\s+/)).toContain(alert.id)
  })

  it('help → aria-describedby 가 도움말을 가리키고, error 와 공존하면 둘 다 포함한다', () => {
    render(
      <FormField id="rrn" label="생년월일" help="숫자 6자리로 적어요" error="형식이 올라요">
        {(field) => <input type="text" {...field} />}
      </FormField>
    )
    const input = screen.getByLabelText(/생년월일/)
    const help = screen.getByText('숫자 6자리로 적어요')
    const alert = screen.getByRole('alert')

    const ids = (input.getAttribute('aria-describedby') ?? '').split(/\s+/)
    expect(help.id).not.toBe('')
    expect(ids).toContain(help.id)
    expect(ids).toContain(alert.id)
  })
})
