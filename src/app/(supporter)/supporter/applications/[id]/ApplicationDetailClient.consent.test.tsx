import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationDetailClient from './ApplicationDetailClient'

/**
 * 신청서 동의 관리 계약 (W 레인). 고아/부분유실 액션 배선 — 철회(withdrawConsent)·수급현황(getBenefitStatus).
 * 설계: Plan&Source/goala_application_consent_management_W.md.
 *
 * 배경: recordConsent 는 이미 배선(체크박스+저장)돼 있으나, 개인정보보호법 철회권(withdrawConsent)과
 *   수급현황 표시(getBenefitStatus)는 화면에 없었다. 이 계약이 그 둘을 못 박는다.
 * RED 사유: '동의 이력'(철회) 섹션·'수급현황' 섹션이 아직 없다(withdrawConsent import·initialBenefitStatus prop 미존재).
 *
 * ★기존 ApplicationDetailClient.test.tsx(선정 선행조건)는 무수정·계속 green 이어야 한다
 *   → initialBenefitStatus 는 optional(기본 null).
 */

const withdrawMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/actions/application', () => ({
  recordConsent: vi.fn().mockResolvedValue({ success: true }),
  updateApplicationStatus: vi.fn(),
  withdrawConsent: (...a: unknown[]) => withdrawMock(...a),
  getApplicationDocumentUrl: vi.fn(),
  uploadApplicationDocument: vi.fn(),
}))
vi.mock('@/app/actions/selection', () => ({ decideSelection: vi.fn() }))

const CONSENTS = [
  { id: 'c1', consent_type: 'general' as const, is_agreed: true, withdrawn_at: null },
  { id: 'c2', consent_type: 'unique_id' as const, is_agreed: true, withdrawn_at: '2026-03-01T00:00:00Z' },
]
const BENEFIT = {
  public_assistance: 'basic_livelihood',
  uses_activity_support: true,
  uses_seoul_additional_support: false,
  participates_in_mohw_pilot: false,
}

const WITHDRAW_GENERAL = '개인정보 수집·이용 동의 철회'
const WITHDRAW_UNIQUE = '고유식별정보(주민등록번호 등) 처리 동의 철회'

beforeEach(() => { withdrawMock.mockReset(); withdrawMock.mockResolvedValue({ success: true }) })
afterEach(() => cleanup())

type Props = React.ComponentProps<typeof ApplicationDetailClient>
function renderClient(overrides: Partial<Props> = {}) {
  return render(
    <ApplicationDetailClient
      applicationId="app-1"
      participantId="p1"
      participantName="참여자A"
      cohortName="2차(2025)"
      status="received"
      isAdmin={false}
      initialConsents={CONSENTS}
      initialDecision={null}
      documents={[]}
      participatesInMohwPilot={false}
      initialBenefitStatus={BENEFIT}
      {...overrides}
    />,
  )
}

describe('ApplicationDetailClient — 동의 철회(withdrawConsent)', () => {
  it('활성 동의엔 철회 버튼, 이미 철회된 동의엔 없다', () => {
    renderClient()
    expect(screen.getByRole('button', { name: WITHDRAW_GENERAL })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: WITHDRAW_UNIQUE })).not.toBeInTheDocument()
    // 이미 철회된 c2 는 상태로 표시.
    expect(screen.getByText(/철회됨/)).toBeInTheDocument()
  })

  it('철회는 바로 실행하지 않고 확인 단계를 거친다', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole('button', { name: WITHDRAW_GENERAL }))
    expect(withdrawMock).not.toHaveBeenCalled()
    expect(screen.getByText(/철회할까요/)).toBeInTheDocument()
  })

  it('확인하면 withdrawConsent(consentId) 호출', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole('button', { name: WITHDRAW_GENERAL }))
    await user.click(screen.getByRole('button', { name: /철회하기/ }))
    await waitFor(() => expect(withdrawMock).toHaveBeenCalledWith('c1'))
  })

  it('그대로 두면 철회 안 함', async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole('button', { name: WITHDRAW_GENERAL }))
    await user.click(screen.getByRole('button', { name: /그대로 두기/ }))
    expect(screen.queryByText(/철회할까요/)).not.toBeInTheDocument()
    expect(withdrawMock).not.toHaveBeenCalled()
  })
})

describe('ApplicationDetailClient — 수급현황(getBenefitStatus)', () => {
  it('수급현황을 값과 함께 보여준다', () => {
    renderClient()
    expect(screen.getByText('수급현황')).toBeInTheDocument()
    expect(screen.getByText('기초생활수급')).toBeInTheDocument()
    // 활동지원 행의 값은 '이용 중'.
    const row = screen.getByText('장애인 활동지원서비스').closest('div') as HTMLElement
    expect(within(row).getByText('이용 중')).toBeInTheDocument()
  })

  it('수급현황이 없으면 빈 상태 안내', () => {
    renderClient({ initialBenefitStatus: null })
    expect(screen.getByText(/아직 입력된 수급현황이 없어요|수급현황이 없어요/)).toBeInTheDocument()
  })
})
