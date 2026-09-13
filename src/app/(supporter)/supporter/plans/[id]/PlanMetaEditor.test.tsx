import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanMetaEditor from './PlanMetaEditor'

/**
 * 이용계획 메타 수정 계약 (W 레인). 부분유실 액션 updateUtilizationPlan 배선 — 생성/제출만 있고 수정이 없던 것.
 * 설계: Plan&Source/goala_assessment_plan_edit_W.md §2.
 *
 * 배경: 계획 메타(작성 방식·조력자·계획 기간)는 생성(new)에만 있고 상세에서 수정 불가였다.
 *   이 편집기가 상세에서 그 메타를 고친다 → updateUtilizationPlan.
 * RED 사유: PlanMetaEditor 가 아직 없다. 액션·라우터 목킹.
 */

const updateMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/actions/utilizationPlan', () => ({
  updateUtilizationPlan: (...a: unknown[]) => updateMock(...a),
}))

const SUPPORTERS = [{ id: 's1', name: '박실무' }, { id: 's2', name: '이실무' }]
const BASE = {
  planId: 'pl1',
  authoredWithSupport: 'with_support',
  assistedById: 's1',
  planPeriodStart: '2026-01-01',
  planPeriodEnd: '2026-12-31',
  supporters: SUPPORTERS,
}

beforeEach(() => { updateMock.mockReset(); updateMock.mockResolvedValue({ success: true }) })
afterEach(() => cleanup())

describe('PlanMetaEditor — 이용계획 메타 수정', () => {
  it('계획 기간이 현재 값으로 채워진다', () => {
    render(<PlanMetaEditor {...BASE} />)
    expect(screen.getByLabelText(/시작/)).toHaveValue('2026-01-01')
    expect(screen.getByLabelText(/종료|끝/)).toHaveValue('2026-12-31')
  })

  it('기간을 고쳐 저장하면 updateUtilizationPlan(planId, 변경값) 호출', async () => {
    const user = userEvent.setup()
    render(<PlanMetaEditor {...BASE} />)
    const end = screen.getByLabelText(/종료|끝/)
    await user.clear(end)
    await user.type(end, '2027-06-30')
    await user.click(screen.getByRole('button', { name: /저장/ }))
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('pl1', expect.objectContaining({ planPeriodEnd: '2027-06-30' })),
    )
  })
})
