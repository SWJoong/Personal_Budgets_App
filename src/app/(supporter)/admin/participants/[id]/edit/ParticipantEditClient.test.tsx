import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ParticipantEditClient from './ParticipantEditClient'

/**
 * 관리자 당사자 정보 수정·삭제 계약 (W 레인). 고아 액션 updateParticipant/deleteParticipant 배선.
 * 설계: Plan&Source/goala_admin_participant_edit_W.md.
 *
 * 배경: 두 액션은 완성돼 있으나 호출 UI 가 없어(미구축) 관리자가 당사자 이름·이메일·담당자를 고치거나
 *   삭제할 수 없었다. 이 폼이 그 UI 다. 삭제는 되돌릴 수 없으므로 인라인 확인 단계를 둔다.
 *
 * RED 사유: ParticipantEditClient 가 아직 없다. 액션·라우터·토스트는 목킹.
 */

const updateMock = vi.fn()
const deleteMock = vi.fn()
const pushMock = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, refresh: vi.fn() }) }))
vi.mock('@/app/actions/admin', () => ({
  updateParticipant: (...a: unknown[]) => updateMock(...a),
  deleteParticipant: (...a: unknown[]) => deleteMock(...a),
}))
vi.mock('@/components/ui/LiveRegion', () => ({ useToast: () => ({ announce: vi.fn() }) }))

const PARTICIPANT = { id: 'p1', name: '김철수', email: 'kim@example.com', assigned_supporter_id: 's1' }
const SUPPORTERS = [
  { id: 's1', name: '박실무' },
  { id: 's2', name: '이실무' },
]

beforeEach(() => {
  updateMock.mockReset(); updateMock.mockResolvedValue({ success: true })
  deleteMock.mockReset(); deleteMock.mockResolvedValue({ success: true })
  pushMock.mockReset()
})
afterEach(() => cleanup())

describe('ParticipantEditClient — 당사자 수정·삭제', () => {
  it('현재 정보로 폼이 채워진다(이름·이메일·담당자)', () => {
    render(<ParticipantEditClient participant={PARTICIPANT} supporters={SUPPORTERS} />)
    expect(screen.getByLabelText('이름')).toHaveValue('김철수')
    expect(screen.getByLabelText('이메일')).toHaveValue('kim@example.com')
    expect(screen.getByLabelText('담당자')).toHaveValue('s1')
  })

  it('이름을 고쳐 저장하면 updateParticipant(id, 변경값) 호출', async () => {
    const user = userEvent.setup()
    render(<ParticipantEditClient participant={PARTICIPANT} supporters={SUPPORTERS} />)
    const name = screen.getByLabelText('이름')
    await user.clear(name)
    await user.type(name, '김영희')
    await user.click(screen.getByRole('button', { name: /저장|수정/ }))
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('p1', expect.objectContaining({ name: '김영희', email: 'kim@example.com', supporterId: 's1' })),
    )
  })

  it('이름이 비면 저장 안 하고 오류 안내', async () => {
    const user = userEvent.setup()
    render(<ParticipantEditClient participant={PARTICIPANT} supporters={SUPPORTERS} />)
    await user.clear(screen.getByLabelText('이름'))
    await user.click(screen.getByRole('button', { name: /저장|수정/ }))
    expect(updateMock).not.toHaveBeenCalled()
    expect(screen.getByText(/이름/)).toBeInTheDocument()
  })

  it('삭제는 확인 단계를 거친다 — 바로 삭제 안 됨', async () => {
    const user = userEvent.setup()
    render(<ParticipantEditClient participant={PARTICIPANT} supporters={SUPPORTERS} />)
    await user.click(screen.getByRole('button', { name: /삭제/ }))
    // 확인 전에는 deleteParticipant 미호출
    expect(deleteMock).not.toHaveBeenCalled()
    // 확인 UI 노출
    expect(screen.getByText(/정말|되돌릴 수 없/)).toBeInTheDocument()
  })

  it('삭제 확인하면 deleteParticipant(id) 호출', async () => {
    const user = userEvent.setup()
    render(<ParticipantEditClient participant={PARTICIPANT} supporters={SUPPORTERS} />)
    await user.click(screen.getByRole('button', { name: /삭제/ }))
    await user.click(screen.getByRole('button', { name: /확인|네, 삭제|삭제할래요/ }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('p1'))
  })
})
