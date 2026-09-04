import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import NewParticipantPage from './page'

/**
 * P6 Phase B — 프리미티브 소비자 배선 계약: 새 당사자 등록 폼 (admin/participants/new).
 * 설계출처: Plan&Source/goala_p6_phaseB_W.md §FormField 소비자 매핑.
 *
 * 버킷: [RED]=오늘 실패(필드별 error= 미배선), [GUARD]=이미 초록(프리미티브 제공) 회귀잠금.
 *
 * ★RED 사유(검증필): 파일에 `error=` 가 전혀 없다. 이름 미입력 제출 시 fail('이름을 입력해주세요.')
 *   → setError + announce(assertive) 이지만, 보이는 문구는 form 레벨 <div>{error}</div>(role=alert 아님)이고
 *   이름 컨트롤에는 aria-invalid 도 aria-describedby 오류연결도 없다.
 *   applications/new 과 동일한 배선 결함 → 동일한 fix(필드별 error state → FormField.error) 를 강제한다.
 *
 * ★시퀀싱: Phase A(#103) 와 겹치지 않음 → rebase 불필요.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/app/actions/admin', () => ({
  createParticipant: vi.fn(async () => ({ success: true })),
}))

function chainable(data: unknown[]) {
  const q: Record<string, unknown> = {}
  q.select = () => q
  q.eq = () => q
  q.order = () => q
  q.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    Promise.resolve({ data, error: null }).then(resolve)
  return q
}

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    from: () => chainable([{ id: 's1', name: '박지원', role: 'supporter' }]),
  }),
}))

function renderPage() {
  return render(
    <LiveRegionProvider>
      <NewParticipantPage />
    </LiveRegionProvider>,
  )
}

describe('admin/participants/new p6 소비자 — FormField 필드별 검증 배선', () => {
  it('[RED] 필수 이름(new-participant-name)을 비운 채 제출하면 그 컨트롤에 aria-invalid=true 가 붙는다', async () => {
    renderPage()
    const submit = await screen.findByRole('button', { name: /당사자 등록하기/ })
    const form = submit.closest('form') as HTMLFormElement

    fireEvent.submit(form) // 이름 비어 있음 → 이름에서 fail()

    // RED: error= 미전달이라 이름 컨트롤에 aria-invalid 가 없다.
    expect(screen.getByLabelText(/이름/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('[RED] 이름 컨트롤의 오류가 aria-describedby 로 연결된 role=alert 노드로 노출된다', async () => {
    renderPage()
    const submit = await screen.findByRole('button', { name: /당사자 등록하기/ })
    const form = submit.closest('form') as HTMLFormElement

    fireEvent.submit(form)

    const field = screen.getByLabelText(/이름/)
    const ids = (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    const errorNode = ids
      .map((id) => document.getElementById(id))
      .find((el) => el?.getAttribute('role') === 'alert')
    // RED: 필드연결 오류 노드 없음(현재 form 레벨 비-alert <div> 뿐).
    expect(errorNode).toBeTruthy()
    expect(within(errorNode as HTMLElement).getByText(/이름|입력/)).toBeInTheDocument()
  })

  it('[GUARD] 이름·이메일·담당지원자가 label 로 도달되고 이름/이메일은 aria-required 를 갖는다', async () => {
    renderPage()
    await screen.findByRole('button', { name: /당사자 등록하기/ })

    expect(screen.getByLabelText(/이름/)).toBeInTheDocument()
    expect(screen.getByLabelText(/이메일/)).toBeInTheDocument()
    expect(screen.getByLabelText('담당 지원자')).toBeInTheDocument()

    expect(screen.getByLabelText(/이름/)).toHaveAttribute('aria-required', 'true')
    expect(screen.getByLabelText(/이메일/)).toHaveAttribute('aria-required', 'true')
  })

  it('[GUARD] 이메일 도움말이 aria-describedby 로 연결된다(new-participant-email-help)', async () => {
    renderPage()
    await screen.findByRole('button', { name: /당사자 등록하기/ })

    const email = screen.getByLabelText(/이메일/)
    expect(email.getAttribute('aria-describedby') ?? '').toContain('new-participant-email-help')
    // 도움말 노드가 실제로 존재.
    const helpId = 'new-participant-email-help'
    expect(document.getElementById(helpId)).not.toBeNull()
  })
})
