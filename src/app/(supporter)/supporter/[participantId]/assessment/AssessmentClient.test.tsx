import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssessmentClient from './AssessmentClient'

/**
 * 욕구사정 화면(실무자) 골든 — GOAL축 B (PR #22).
 * 목록·빈 상태·생성(액션 인자)·삭제·에러 표시를 못박는다.
 *
 * 접근성: jest-axe(의존성=U 레인) 미설치라, 라벨/역할 이름으로 접근하는 쿼리
 * (getByLabelText · getByRole{name}) 로 a11y 배선을 강제한다 — 라벨-입력 연결이나
 * 버튼 접근성 이름이 깨지면 이 테스트가 실패한다. (색 대비는 실제 브라우저/axe 필요 — 별도.)
 */

const createMock = vi.fn()
const deleteMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

vi.mock('@/app/actions/needsAssessment', () => ({
  createNeedsAssessment: (...args: unknown[]) => createMock(...args),
  deleteNeedsAssessment: (...args: unknown[]) => deleteMock(...args),
}))

const domains = [
  { id: 'dom-daily', program: 'seoul', code: 'daily_living', label: '일상생활', sort_order: 1 },
  { id: 'dom-social', program: 'seoul', code: 'social_life', label: '사회생활', sort_order: 2 },
]

const assessments = [
  {
    id: 'na-1',
    program: 'seoul',
    domain_id: 'dom-daily',
    subdomain_id: null,
    support_example: '이동 지원 서비스',
    limitation: '혼자 버스 타기 어려움',
    need_hope: '혼자 외출하고 싶어요',
    created_at: '2026-08-19T00:00:00Z',
  },
]

describe('AssessmentClient — 욕구사정 화면(실무자)', () => {
  beforeEach(() => {
    createMock.mockReset()
    deleteMock.mockReset()
    refreshMock.mockReset()
  })

  it('빈 상태: 적은 욕구가 없으면 안내 문구를 보여준다', () => {
    render(<AssessmentClient participantId="p-1" assessments={[]} domains={domains} />)
    expect(screen.getByText(/아직 적은 욕구가 없어요/)).toBeInTheDocument()
  })

  it('목록: 대분류 라벨을 domain_id 로 매핑하고 어려운 점·바라는 것·도움이 될 것을 보여준다', () => {
    render(<AssessmentClient participantId="p-1" assessments={assessments} domains={domains} />)
    // '일상생활'은 카드 라벨과 select 옵션 양쪽에 나와 모호 → 매핑은 아래 삭제 버튼 이름이 증명.
    expect(screen.getByText(/혼자 버스 타기 어려움/)).toBeInTheDocument()
    expect(screen.getByText(/혼자 외출하고 싶어요/)).toBeInTheDocument()
    expect(screen.getByText(/이동 지원 서비스/)).toBeInTheDocument()
    // 삭제 버튼 접근성 이름(항목이 무엇인지 스크린리더로 구분 가능)
    expect(screen.getByRole('button', { name: '일상생활 욕구 지우기' })).toBeInTheDocument()
  })

  it('생성: 영역 선택 전 버튼은 비활성, 선택·입력 후 저장하면 올바른 인자로 액션을 호출한다', async () => {
    createMock.mockResolvedValue({ success: true, id: 'na-new' })
    const user = userEvent.setup()
    render(<AssessmentClient participantId="p-1" assessments={[]} domains={domains} />)

    const submit = screen.getByRole('button', { name: '욕구 추가하기' })
    expect(submit).toBeDisabled() // 영역 미선택 → 비활성

    // 전부 라벨로 접근 (a11y 배선 강제)
    await user.selectOptions(screen.getByLabelText(/도움이 필요한 영역/), 'dom-daily')
    await user.type(screen.getByLabelText('어떤 점이 어려운가요?'), '혼자 이동이 어려움')
    await user.type(screen.getByLabelText('무엇을 바라나요?'), '혼자 외출하고 싶어요')

    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          participantId: 'p-1',
          program: 'seoul',
          domainId: 'dom-daily',
          limitation: '혼자 이동이 어려움',
          needHope: '혼자 외출하고 싶어요',
        })
      )
    )
    expect(refreshMock).toHaveBeenCalled()
  })

  it('생성 에러: 액션이 error 를 돌려주면 화면에 그대로 보여주고 새로고침하지 않는다', async () => {
    createMock.mockResolvedValue({ error: '욕구사정 저장 실패: 권한이 없어요.' })
    const user = userEvent.setup()
    render(<AssessmentClient participantId="p-1" assessments={[]} domains={domains} />)

    await user.selectOptions(screen.getByLabelText(/도움이 필요한 영역/), 'dom-daily')
    await user.click(screen.getByRole('button', { name: '욕구 추가하기' }))

    await waitFor(() =>
      expect(screen.getByText('욕구사정 저장 실패: 권한이 없어요.')).toBeInTheDocument()
    )
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('삭제: 지우기를 누르면 해당 id 로 삭제 액션을 호출하고 새로고침한다', async () => {
    deleteMock.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<AssessmentClient participantId="p-1" assessments={assessments} domains={domains} />)

    await user.click(screen.getByRole('button', { name: '일상생활 욕구 지우기' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('na-1'))
    expect(refreshMock).toHaveBeenCalled()
  })
})
