import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserRoleManagementClient from './UserRoleManagementClient'

/**
 * 관리자 역할 관리 계약 (W 레인). 고아 액션 getAllUsers/updateUserRole 배선 — 완성됐으나 호출 UI 가 없던 것.
 * 설계: Plan&Source/goala_admin_role_management_W.md.
 *
 * 배경: 관리자가 전체 사용자의 역할(관리자/실무자/당사자)을 목록에서 바꾸는 화면.
 *   본인 역할은 바꿀 수 없고(락아웃 방지), 역할 변경은 결과가 커 확인 단계를 거친다.
 * RED 사유: UserRoleManagementClient 가 아직 없다. 액션·라우터·토스트 목킹.
 */

const updateMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/actions/admin', () => ({
  updateUserRole: (...a: unknown[]) => updateMock(...a),
}))
vi.mock('@/components/ui/LiveRegion', () => ({ useToast: () => ({ announce: vi.fn() }) }))

const USERS = [
  { id: 'me', name: '나관리', email: 'me@ex.com', role: 'admin' as const, created_at: '2026-01-01T00:00:00Z' },
  { id: 'u2', name: '박실무', email: 'park@ex.com', role: 'supporter' as const, created_at: '2026-02-01T00:00:00Z' },
  { id: 'u3', name: '이당사', email: 'lee@ex.com', role: 'participant' as const, created_at: '2026-03-01T00:00:00Z' },
]

beforeEach(() => { updateMock.mockReset(); updateMock.mockResolvedValue({ success: true }) })
afterEach(() => cleanup())

function renderClient() {
  return render(<UserRoleManagementClient users={USERS} currentUserId="me" />)
}

// 특정 사용자 이름이 든 행(<li>)을 집는다.
function rowOf(name: string): HTMLElement {
  const li = screen.getByText(name).closest('li')
  if (!li) throw new Error(`행을 찾지 못함: ${name}`)
  return li as HTMLElement
}

describe('UserRoleManagementClient — 역할 관리', () => {
  it('모든 사용자를 이름·이메일과 함께 보여준다', () => {
    renderClient()
    expect(screen.getByText('나관리')).toBeInTheDocument()
    expect(screen.getByText('박실무')).toBeInTheDocument()
    expect(screen.getByText('이당사')).toBeInTheDocument()
    expect(screen.getByText('park@ex.com')).toBeInTheDocument()
  })

  it('본인 행은 역할을 바꿀 수 없다(컨트롤 없음·"나" 표시)', () => {
    renderClient()
    // 역할 select 는 비본인 2명에게만 있다.
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    // 본인 표시.
    expect(screen.getByText('나')).toBeInTheDocument()
    expect(screen.getByText(/자신의 역할/)).toBeInTheDocument()
  })

  it('비본인 행의 select 는 현재 역할로 채워진다', () => {
    renderClient()
    expect(screen.getByLabelText(/박실무/)).toHaveValue('supporter')
    expect(screen.getByLabelText(/이당사/)).toHaveValue('participant')
  })

  it('역할을 바꾸면 바로 저장하지 않고 확인 단계를 거친다', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.selectOptions(screen.getByLabelText(/박실무/), 'admin')
    const row = rowOf('박실무')
    await user.click(within(row).getByRole('button', { name: '변경' }))
    // 확인 전에는 미호출 + 확인 문구 노출.
    expect(updateMock).not.toHaveBeenCalled()
    expect(within(row).getByText(/바꿀까요/)).toBeInTheDocument()
  })

  it('확인하면 updateUserRole(userId, newRole) 호출', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.selectOptions(screen.getByLabelText(/박실무/), 'admin')
    const row = rowOf('박실무')
    await user.click(within(row).getByRole('button', { name: '변경' }))
    await user.click(within(row).getByRole('button', { name: /바꾸기/ }))
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('u2', 'admin'))
  })

  it('그대로 두면 저장 안 함', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.selectOptions(screen.getByLabelText(/박실무/), 'admin')
    const row = rowOf('박실무')
    await user.click(within(row).getByRole('button', { name: '변경' }))
    await user.click(within(row).getByRole('button', { name: /그대로 두기/ }))
    expect(within(row).queryByText(/바꿀까요/)).not.toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
  })
})
