import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssessmentClient from './AssessmentClient'

/**
 * 욕구사정 수정 계약 (W 레인). 부분유실 액션 updateNeedsAssessment 배선 — 생성/삭제만 있고 수정이 없던 것.
 * 설계: Plan&Source/goala_assessment_plan_edit_W.md §1.
 *
 * 배경: AssessmentClient 는 create/delete 만 호출. 각 항목에 '수정'을 더해 인라인 편집 → updateNeedsAssessment.
 * RED 사유: 수정 UI 가 아직 없다. 액션·라우터 목킹.
 */

const updateMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/actions/needsAssessment', () => ({
  createNeedsAssessment: vi.fn().mockResolvedValue({ success: true }),
  deleteNeedsAssessment: vi.fn().mockResolvedValue({ success: true }),
  updateNeedsAssessment: (...a: unknown[]) => updateMock(...a),
}))

const DOMAINS = [
  { id: 'd1', program: 'seoul', code: 'social', label: '사회생활', sort_order: 1 },
  { id: 'd2', program: 'seoul', code: 'daily', label: '일상생활', sort_order: 2 },
]
const ASSESSMENTS = [
  { id: 'a1', program: 'seoul', domain_id: 'd1', subdomain_id: null, support_example: '이동 지원', limitation: '버스 타기 어려움', need_hope: '혼자 외출', created_at: '2026-09-01' },
]

beforeEach(() => { updateMock.mockReset(); updateMock.mockResolvedValue({ success: true }) })
afterEach(() => cleanup())

function renderClient() {
  return render(<AssessmentClient participantId="p1" assessments={ASSESSMENTS} domains={DOMAINS} subdomains={[]} />)
}

describe('AssessmentClient — 욕구사정 수정', () => {
  it('각 항목에 수정 버튼이 있다', () => {
    renderClient()
    expect(screen.getByRole('button', { name: /수정/ })).toBeInTheDocument()
  })

  it('수정을 누르면 현재 값으로 채워진 편집 폼이 열린다', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole('button', { name: /수정/ }))
    // 현재 값 프리필(어려운 점·바라는 것).
    expect(screen.getByDisplayValue('버스 타기 어려움')).toBeInTheDocument()
    expect(screen.getByDisplayValue('혼자 외출')).toBeInTheDocument()
  })

  it('고쳐서 저장하면 updateNeedsAssessment(id, 변경값) 호출', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole('button', { name: /수정/ }))
    const field = screen.getByDisplayValue('버스 타기 어려움')
    await user.clear(field)
    await user.type(field, '지하철 타기 어려움')
    // 편집 폼 안의 저장 버튼(생성 폼의 '욕구 추가하기'와 구분).
    await user.click(screen.getByRole('button', { name: /저장|수정 저장|저장하기/ }))
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('a1', expect.objectContaining({ limitation: '지하철 타기 어려움' })),
    )
  })

  it('취소하면 편집 폼이 닫히고 저장 안 함', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole('button', { name: /수정/ }))
    await user.click(screen.getByRole('button', { name: /취소/ }))
    expect(screen.queryByDisplayValue('버스 타기 어려움')).not.toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
  })
})
