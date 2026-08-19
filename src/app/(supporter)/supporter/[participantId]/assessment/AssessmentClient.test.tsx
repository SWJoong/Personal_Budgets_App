import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssessmentClient from './AssessmentClient'

/**
 * 욕구사정 화면(실무자) 골든 — GOAL축 B (PR #22 + #26 제도 토글·중분류).
 * 목록·빈 상태·생성(액션 인자)·삭제·에러 + 제도(서울형/복지부) 토글·중분류(subdomain)를 못박는다.
 *
 * 접근성: jest-axe(의존성=U 레인) 미설치라, 라벨/역할 이름 쿼리(getByLabelText · getByRole{name})로
 * a11y 배선을 강제한다 — 라벨-입력 연결이나 버튼 접근성 이름이 깨지면 실패. (색 대비는 실브라우저/axe 별도.)
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
  { id: 'dom-mohw-health', program: 'mohw', code: 'physical_health', label: '신체적건강', sort_order: 1 },
]

const subdomains = [
  { id: 'sub-rehab', domain_id: 'dom-mohw-health', code: 'rehabilitation', label: '재활', sort_order: 2 },
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
    render(<AssessmentClient participantId="p-1" assessments={[]} domains={domains} subdomains={subdomains} />)
    expect(screen.getByText(/아직 적은 욕구가 없어요/)).toBeInTheDocument()
  })

  it('목록: 어려운 점·바라는 것·도움이 될 것 + domain_id→라벨 매핑(삭제 버튼 이름으로 증명)', () => {
    render(
      <AssessmentClient participantId="p-1" assessments={assessments} domains={domains} subdomains={subdomains} />
    )
    // '일상생활'은 카드 라벨과 select 옵션 양쪽에 나와 모호 → 매핑은 삭제 버튼 이름이 증명.
    expect(screen.getByText(/혼자 버스 타기 어려움/)).toBeInTheDocument()
    expect(screen.getByText(/혼자 외출하고 싶어요/)).toBeInTheDocument()
    expect(screen.getByText(/이동 지원 서비스/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '일상생활 욕구 지우기' })).toBeInTheDocument()
  })

  it('생성(서울형): 영역 미선택 시 버튼 비활성 → 선택·입력 후 subdomainId=null 로 저장', async () => {
    createMock.mockResolvedValue({ success: true, id: 'na-new' })
    const user = userEvent.setup()
    render(<AssessmentClient participantId="p-1" assessments={[]} domains={domains} subdomains={subdomains} />)

    const submit = screen.getByRole('button', { name: '욕구 추가하기' })
    expect(submit).toBeDisabled()

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
          subdomainId: null, // 서울형은 flat → 중분류 없음
          limitation: '혼자 이동이 어려움',
          needHope: '혼자 외출하고 싶어요',
        })
      )
    )
    expect(refreshMock).toHaveBeenCalled()
  })

  it('제도 토글: 서울형↔보건복지부 전환 시 대분류 선택지가 바뀐다', async () => {
    const user = userEvent.setup()
    render(<AssessmentClient participantId="p-1" assessments={[]} domains={domains} subdomains={subdomains} />)

    // 기본 서울형: 서울 도메인만 옵션에
    expect(screen.getByRole('option', { name: '일상생활' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '신체적건강' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '보건복지부' }))

    expect(screen.getByRole('option', { name: '신체적건강' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '일상생활' })).not.toBeInTheDocument()
  })

  it('생성(복지부): 중분류 있는 대분류 선택 시 세부 영역(중분류)이 나오고 subdomainId 로 저장', async () => {
    createMock.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<AssessmentClient participantId="p-1" assessments={[]} domains={domains} subdomains={subdomains} />)

    await user.click(screen.getByRole('button', { name: '보건복지부' }))
    await user.selectOptions(screen.getByLabelText(/도움이 필요한 영역/), 'dom-mohw-health')
    // 중분류 select 등장(복지부 + 해당 대분류에 중분류 존재)
    await user.selectOptions(screen.getByLabelText(/세부 영역/), 'sub-rehab')
    await user.click(screen.getByRole('button', { name: '욕구 추가하기' }))

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          program: 'mohw',
          domainId: 'dom-mohw-health',
          subdomainId: 'sub-rehab',
        })
      )
    )
  })

  it('생성 에러: 액션이 error 를 돌려주면 화면에 보여주고 새로고침하지 않는다', async () => {
    createMock.mockResolvedValue({ error: '욕구사정 저장 실패: 권한이 없어요.' })
    const user = userEvent.setup()
    render(<AssessmentClient participantId="p-1" assessments={[]} domains={domains} subdomains={subdomains} />)

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
    render(
      <AssessmentClient participantId="p-1" assessments={assessments} domains={domains} subdomains={subdomains} />
    )

    await user.click(screen.getByRole('button', { name: '일상생활 욕구 지우기' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('na-1'))
    expect(refreshMock).toHaveBeenCalled()
  })
})
