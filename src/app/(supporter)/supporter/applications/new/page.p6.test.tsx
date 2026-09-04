import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import NewApplicationPage from './page'

/**
 * P6 Phase B — 프리미티브 소비자 배선 계약: 신청서 접수 폼 (applications/new).
 * 설계출처: Plan&Source/goala_p6_phaseB_W.md §FormField 소비자 매핑.
 *
 * 버킷 표기(impl·리뷰어가 헷갈리지 않도록 각 it 이름에 명시):
 *   [RED]   현재 main 에서 진짜 실패 — impl 강제(필드별 error= 배선).
 *   [GUARD] 이미 초록(FormField 프리미티브가 label/required/help 를 이미 제공) — 회귀잠금.
 *
 * ★핵심 RED 사유(검증필): 이 파일에는 `error=` 가 단 한 번도 FormField 에 전달되지 않는다.
 *   빈 필수값으로 제출하면 fail() 이 form 레벨 <div>{error}</div>(role=alert 아님) 만 그리고,
 *   announce(assertive) 로 LiveRegion alert 에 문구를 넣을 뿐 — 정작 문제의 **컨트롤**에는
 *   aria-invalid 도, aria-describedby 로 연결된 오류문도 붙지 않는다.
 *   → getByLabelText(field).toHaveAttribute('aria-invalid','true') 가 오늘 실패한다.
 *
 * 주의: LiveRegion 의 role=alert(공지)와 FormField 의 필드연결 오류(role=alert)를 혼동하지 않기 위해
 *   RED 는 getByRole('alert') 가 아니라 **컨트롤의 aria-invalid + aria-describedby→오류노드** 로 단언한다
 *   (fail() 이 assertive 공지를 넣으므로 getByRole('alert') 는 LiveRegion 때문에 통과해 RED 를 가린다).
 *
 * ★시퀀싱: 이 파일은 Phase A(#103) 와 겹치지 않음 → rebase 불필요.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/app/actions/application', () => ({
  createApplication: vi.fn(async () => ({ applicationId: 'app-1' })),
  recordBenefitStatus: vi.fn(async () => ({ success: true })),
}))

// 데이터 로드용 supabase 체이너블 스텁: .select().order() / .select().eq().order() 모두 thenable.
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
    from: (table: string) =>
      chainable(
        table === 'participants'
          ? [{ id: 'p1', name: '김지수' }]
          : table === 'seoul_cohorts'
            ? [{ id: 'c1', name: '1차', code: '2026-1' }]
            : [],
      ),
  }),
}))

function renderPage() {
  return render(
    <LiveRegionProvider>
      <NewApplicationPage />
    </LiveRegionProvider>,
  )
}

describe('applications/new p6 소비자 — FormField 필드별 검증 배선', () => {
  it('[RED] 필수 차수(app-cohort)를 비운 채 제출하면 그 컨트롤에 aria-invalid=true 가 붙는다', async () => {
    renderPage()
    // 로딩 플립(useEffect→loadData)이 끝나 폼이 나올 때까지 대기.
    const submit = await screen.findByRole('button', { name: /신청서 접수하기/ })
    const form = submit.closest('form') as HTMLFormElement

    // 당사자만 고르고 차수는 비운 채 제출 → handleSubmit 이 차수에서 fail() 한다.
    fireEvent.change(screen.getByLabelText(/당사자/), { target: { value: 'p1' } })
    fireEvent.submit(form)

    // RED: 오늘은 error= 를 FormField 에 넘기지 않으므로 컨트롤에 aria-invalid 가 없다.
    expect(screen.getByLabelText(/차수/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('[RED] 차수 컨트롤의 오류가 aria-describedby 로 연결된 role=alert 노드로 노출된다', async () => {
    renderPage()
    const submit = await screen.findByRole('button', { name: /신청서 접수하기/ })
    const form = submit.closest('form') as HTMLFormElement

    fireEvent.change(screen.getByLabelText(/당사자/), { target: { value: 'p1' } })
    fireEvent.submit(form)

    const field = screen.getByLabelText(/차수/)
    const ids = (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    const errorNode = ids
      .map((id) => document.getElementById(id))
      .find((el) => el?.getAttribute('role') === 'alert')
    // RED: 필드에 연결된 오류 노드가 없다(현재는 form 레벨 비-alert <div> 뿐).
    expect(errorNode).toBeTruthy()
    expect(within(errorNode as HTMLElement).getByText(/차수|선택|입력/)).toBeInTheDocument()
  })

  it('[GUARD] 모든 입력이 label 로 도달 가능하고 필수 필드는 aria-required 를 갖는다', async () => {
    renderPage()
    await screen.findByRole('button', { name: /신청서 접수하기/ })

    expect(screen.getByLabelText(/당사자/)).toBeInTheDocument()
    expect(screen.getByLabelText(/차수/)).toBeInTheDocument()
    expect(screen.getByLabelText('접수번호')).toBeInTheDocument()
    expect(screen.getByLabelText('공공부조 수급현황')).toBeInTheDocument()

    expect(screen.getByLabelText(/당사자/)).toHaveAttribute('aria-required', 'true')
    expect(screen.getByLabelText(/차수/)).toHaveAttribute('aria-required', 'true')
  })

  it('[GUARD] 수급현황 select 변경(onChange)은 상태만 바꾸고 자동 제출/이동하지 않는다', async () => {
    renderPage()
    await screen.findByRole('button', { name: /신청서 접수하기/ })

    const select = screen.getByLabelText('공공부조 수급현황') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'basic_livelihood' } })
    // 폼이 그대로 남아 있으면(제출/네비게이션 없음) 배선이 옳다.
    expect(screen.getByRole('button', { name: /신청서 접수하기/ })).toBeInTheDocument()
    expect(select.value).toBe('basic_livelihood')
  })
})
