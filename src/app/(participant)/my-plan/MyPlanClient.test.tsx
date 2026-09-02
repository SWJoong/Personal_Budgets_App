import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyPlanClient from './MyPlanClient'

const fileAppealMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/actions/planReview', () => ({
  markNotificationRead: vi.fn(),
}))

vi.mock('@/app/actions/appeal', () => ({
  fileAppeal: (...args: unknown[]) => fileAppealMock(...args),
}))

// AI 활동 제안 자식 컴포넌트는 서버 액션(activitySuggestion → ai.ts/Anthropic)을 import 하므로
// jsdom 에서 모듈 로드 시 "browser-like environment" 로 터진다. 이 테스트 대상은 이의신청·통지라
// AI 제안과 무관 → 자식을 스텁으로 격리(단위 경계). ActivitySuggestions 자체 검증은 별도.
vi.mock('./ActivitySuggestions', () => ({
  default: () => null,
}))

const basePlan = { id: 'plan-1', application_id: 'app-1', cohort_id: 'cohort-1', status: 'rejected' }
const baseNotification = { id: 'notif-1', is_read_by_participant: true }
const baseReview = { id: 'review-1', decision: 'rejected', reason: '요건 미충족' }

describe('MyPlanClient — 이의신청(다시 봐달라고 요청하기)', () => {
  beforeEach(() => {
    fileAppealMock.mockReset()
  })

  it('반려 결정에 "다시 봐달라고 요청하기"가 보이고, 본인이 직접 요청을 낼 수 있다 (S3: 자기 이의신청)', async () => {
    fileAppealMock.mockResolvedValue({ success: true, appealId: 'appeal-1' })

    const user = userEvent.setup()
    render(
      <MyPlanClient
        participantId="participant-1"
        plan={basePlan}
        narrative={null}
        requestedServices={[]}
        latestReview={baseReview}
        notification={baseNotification}
        appeal={null}
      />
    )

    await user.click(screen.getByRole('button', { name: '다시 봐달라고 요청하기' }))
    await user.type(screen.getByPlaceholderText('어떤 점을 다시 봐주면 좋을지 적어주세요'), '재검토 부탁드려요')
    await user.click(screen.getByRole('button', { name: '요청 보내기' }))

    await waitFor(() => {
      expect(fileAppealMock).toHaveBeenCalledWith(
        expect.objectContaining({ notificationId: 'notif-1', participantId: 'participant-1', ground: '재검토 부탁드려요' })
      )
    })
  })

  it('이미 낸 이의신청이 있으면 결과만 보여주고, 본인이 결과를 바꿀 수 있는 조작은 화면에 없다 (S6: 결과 자기변경 차단)', () => {
    render(
      <MyPlanClient
        participantId="participant-1"
        plan={basePlan}
        narrative={null}
        requestedServices={[]}
        latestReview={baseReview}
        notification={baseNotification}
        appeal={{ id: 'appeal-1', outcome: 'pending', outcome_reason: null }}
      />
    )

    expect(screen.getByText('아직 확인하고 있어요')).toBeInTheDocument()
    // 참여자 화면에는 outcome 을 직접 바꾸는 버튼이 애초에 없다 —
    // 그 조작은 실무자 화면(ParticipantDetailClient, requireAdmin 게이트)에만 있다.
    expect(screen.queryByRole('button', { name: '전부 반영' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '그대로 유지' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '요청 보내기' })).not.toBeInTheDocument()
  })

  it('계획은 열람 전용이다 — 담당자가 적은 내용을 보여주되 작성·저장·제출 조작은 없다 (작성 주체=담당자)', () => {
    render(
      <MyPlanClient
        participantId="participant-1"
        plan={{ id: 'plan-1', application_id: 'app-1', cohort_id: 'cohort-1', status: 'draft' }}
        narrative={{
          strengths_talents: '그림 그리기',
          social_barriers: null,
          desired_change: null,
          desired_life: null,
          goal_to_try: null,
        }}
        requestedServices={[{ id: 'rs-1', priority: 1, service_name: '웹툰 학원', estimated_cost: 300000 }]}
        latestReview={null}
        notification={null}
        appeal={null}
      />
    )

    // 담당자가 적은 내용은 열람된다
    expect(screen.getByText('그림 그리기')).toBeInTheDocument()
    expect(screen.getByText('웹툰 학원')).toBeInTheDocument()

    // 당사자가 계획을 쓰거나 제출하는 조작은 화면에 없다 — 작성 주체는 담당자다
    expect(screen.queryByRole('button', { name: '계획 시작하기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장하기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '제출하기' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('예: 웹툰 학원 수강')).not.toBeInTheDocument()
  })
})
