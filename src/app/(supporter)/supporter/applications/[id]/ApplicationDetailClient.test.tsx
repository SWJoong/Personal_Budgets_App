import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationDetailClient from './ApplicationDetailClient'

const CONSENT_PRECONDITION_MESSAGE =
  '개인정보 수집·이용 동의와 고유식별정보 별도 동의가 모두 있어야 선정할 수 있습니다. (현재 0건)'

const decideSelectionMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/actions/application', () => ({
  recordConsent: vi.fn(),
  updateApplicationStatus: vi.fn(),
}))

vi.mock('@/app/actions/selection', () => ({
  decideSelection: (...args: unknown[]) => decideSelectionMock(...args),
}))

describe('ApplicationDetailClient — 동의 선행조건이 화면에 실제로 나타나는지', () => {
  beforeEach(() => {
    decideSelectionMock.mockReset()
  })

  it('동의 미완료 상태에서 선정을 시도하면, DB 트리거가 낸 에러 메시지를 화면에 그대로 보여준다', async () => {
    // supabase/seoul/03_seoul_schema.sql 의 seoul_enforce_consent_precondition() 트리거가
    // 실제로 내는 예외 메시지를 흉내낸다 — verify_04_phase2.sql 의 P2 가 DB 쪽을,
    // 이 테스트가 화면 쪽을 검증한다.
    decideSelectionMock.mockResolvedValue({ error: CONSENT_PRECONDITION_MESSAGE })

    const user = userEvent.setup()
    render(
      <ApplicationDetailClient
        applicationId="app-1"
        participantId="participant-1"
        participantName="참여자A"
        cohortName="2차(2025)"
        status="received"
        isAdmin
        initialConsents={[]}
        initialDecision={null}
      />
    )

    await user.click(screen.getByRole('button', { name: '선정' }))

    await waitFor(() => {
      expect(screen.getByText(CONSENT_PRECONDITION_MESSAGE)).toBeInTheDocument()
    })
    expect(decideSelectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: 'app-1', isSelected: true })
    )
  })

  it('이미 선정 결정이 있으면 선정/선정 안 함 버튼 대신 결과만 보여준다', () => {
    render(
      <ApplicationDetailClient
        applicationId="app-1"
        participantId="participant-1"
        participantName="참여자A"
        cohortName="2차(2025)"
        status="selected"
        isAdmin
        initialConsents={[]}
        initialDecision={{ is_selected: true, selection_reason: '지원요건 충족' }}
      />
    )

    // '선정됨'은 상태 배지와 결정 결과 두 곳에 나온다 — 결정 사유(고유 텍스트)로 확인한다.
    expect(screen.getByText('지원요건 충족')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '선정' })).not.toBeInTheDocument()
  })
})
