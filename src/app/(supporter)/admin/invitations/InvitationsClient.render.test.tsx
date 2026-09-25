import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InvitationsClient from './InvitationsClient'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import { createInvitation } from '@/app/actions/admin'

/**
 * 초대 만들기 — 오류 안내 채널 계약(실제 LiveRegionProvider 사용).
 * 한 오류는 한 번만 읽는다: 이메일 칸의 role=alert(FormField). 전역 알림 영역까지 쓰면 두 번 읽힌다.
 * 단, 같은 오류가 이미 떠 있는 채로 다시 제출하면 칸의 DOM 이 안 바뀌어 무음 → 그때만 전역으로 다시 알린다.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/actions/admin', () => ({
  createInvitation: vi.fn(),
  deleteInvitation: vi.fn(),
}))

const SERVER_ERR = '이미 초대한 이메일이에요.'
const EMPTY_ERR = '이메일을 입력해 주세요.'

function alertsWith(text: string) {
  return screen.getAllByRole('alert').filter((el) => el.textContent?.includes(text))
}
function globalAlert() {
  return screen.getAllByRole('alert').find((el) => el.getAttribute('aria-live') === 'assertive')!
}
function submit() {
  fireEvent.submit(screen.getByRole('button', { name: '초대 만들기' }).closest('form') as HTMLFormElement)
}

function renderClient() {
  return render(
    <LiveRegionProvider>
      <InvitationsClient invitations={[]} />
    </LiveRegionProvider>,
  )
}

beforeEach(() => {
  vi.mocked(createInvitation).mockReset()
})

describe('InvitationsClient — 오류는 한 번만 읽힌다', () => {
  it('서버 오류: 오류가 든 alert 는 칸의 것 1개뿐이고, 같은 오류로 다시 실패하면 칸의 alert 가 새로 들어간다', async () => {
    vi.mocked(createInvitation).mockResolvedValue({ error: SERVER_ERR })
    renderClient()
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 'a@example.com' } })

    submit()
    await waitFor(() => expect(alertsWith(SERVER_ERR)).toHaveLength(1))
    const first = alertsWith(SERVER_ERR)[0]
    expect(globalAlert()).toHaveTextContent('')

    await waitFor(() => expect(screen.getByRole('button', { name: '초대 만들기' })).toBeEnabled())
    submit()
    await waitFor(() => expect(vi.mocked(createInvitation)).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(alertsWith(SERVER_ERR)).toHaveLength(1))
    expect(alertsWith(SERVER_ERR)[0]).not.toBe(first)
    expect(globalAlert()).toHaveTextContent('')
  })

  it('빈 이메일: 첫 제출은 칸의 alert 로만, 그대로 다시 제출하면(칸 DOM 불변) 전역으로 다시 알린다', () => {
    renderClient()
    submit()
    expect(alertsWith(EMPTY_ERR)).toHaveLength(1)
    expect(globalAlert()).toHaveTextContent('')

    submit()
    expect(globalAlert()).toHaveTextContent(EMPTY_ERR)
    expect(createInvitation).not.toHaveBeenCalled()
  })
})
