import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StaffReviewSuggestions from './StaffReviewSuggestions'

/**
 * 실무자용 AI 점검 제안 — 화면 계약 (W 레인). 관리자 QA #6.
 * 설계출처: Plan&Source/goala_staff_review_assistant_W.md §4.
 * 구현 대상: src/app/(supporter)/supporter/[participantId]/checkup/StaffReviewSuggestions.tsx.
 *
 * 온디맨드: 버튼을 눌러야 액션 호출(비용 제어). 상태 = 로딩/제안/빈/에러 + 과신방지 안전고지.
 * RED 사유: 컴포넌트가 아직 없다. 액션은 목킹(순수 화면 계약).
 */

const genMock = vi.fn()
vi.mock('@/app/actions/staffReviewSuggestion', () => ({
  generateStaffReviewSuggestions: (...args: unknown[]) => genMock(...args),
}))

beforeEach(() => genMock.mockReset())
afterEach(() => cleanup())

describe('StaffReviewSuggestions — 온디맨드 AI 점검 제안(#6)', () => {
  it('처음엔 트리거 버튼만 있고 결과는 없다', () => {
    render(<StaffReviewSuggestions participantId="p-1" />)
    expect(screen.getByRole('button', { name: /점검 제안/ })).toBeInTheDocument()
    expect(genMock).not.toHaveBeenCalled()
  })

  it('버튼 클릭 → generateStaffReviewSuggestions(participantId) 호출 후 제안을 렌더한다', async () => {
    genMock.mockResolvedValue({
      suggestions: [
        { priority: 'high', headline: '예산 한도 재점검', action: '계획 조정 또는 영역 재배분을 검토하세요.', basis: 'budget_ceiling' },
      ],
    })
    const user = userEvent.setup()
    render(<StaffReviewSuggestions participantId="p-1" />)
    await user.click(screen.getByRole('button', { name: /점검 제안/ }))

    await waitFor(() => expect(screen.getByText('예산 한도 재점검')).toBeInTheDocument())
    expect(genMock).toHaveBeenCalledWith('p-1')
    expect(screen.getByText(/영역 재배분을 검토하세요/)).toBeInTheDocument()
  })

  it('제안과 함께 과신 방지 안전 고지를 보여준다', async () => {
    genMock.mockResolvedValue({
      suggestions: [{ priority: 'medium', headline: '점검 결정', action: '승인/반려하세요.', basis: 'rulecheck_pending' }],
    })
    const user = userEvent.setup()
    render(<StaffReviewSuggestions participantId="p-1" />)
    await user.click(screen.getByRole('button', { name: /점검 제안/ }))

    await waitFor(() => expect(screen.getByText('점검 결정')).toBeInTheDocument())
    // 과신 방지: 최종 판단은 사람이.
    expect(screen.getByText(/최종 판단은 선생님이/)).toBeInTheDocument()
  })

  it('제안이 없으면(전부 정상) 빈 상태 문구를 보여준다', async () => {
    genMock.mockResolvedValue({ suggestions: [] })
    const user = userEvent.setup()
    render(<StaffReviewSuggestions participantId="p-1" />)
    await user.click(screen.getByRole('button', { name: /점검 제안/ }))

    await waitFor(() => expect(screen.getByText(/점검할 항목이 없어요/)).toBeInTheDocument())
  })

  it('액션이 에러를 반환하면 친절 에러 문구를 보여준다', async () => {
    genMock.mockResolvedValue({ error: '점검 제안을 만들지 못했어요. 잠시 후 다시 해주세요.' })
    const user = userEvent.setup()
    render(<StaffReviewSuggestions participantId="p-1" />)
    await user.click(screen.getByRole('button', { name: /점검 제안/ }))

    await waitFor(() => expect(screen.getByText(/점검 제안을 만들지 못했어요/)).toBeInTheDocument())
  })
})
