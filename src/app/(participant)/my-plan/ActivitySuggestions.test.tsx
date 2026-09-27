import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import { AI_NOTICE_PARTICIPANT } from '@/components/ui/AiNotice'
import ActivitySuggestions from './ActivitySuggestions'

/**
 * AI 활동 제안(당사자) — 공통 AI 표시 라벨(AiNotice participant) 소비 계약.
 * 투명성: 버튼을 누르기 전(사전 고지)과 제안이 뜬 뒤(생성물 표시) 모두 라벨이 보인다.
 * 당사자 대면이라 'AI' 리터럴 대신 '컴퓨터' 쉬운 말(P7 B4). 액션은 목킹(Anthropic 미호출).
 */

const genMock = vi.fn()
vi.mock('@/app/actions/activitySuggestion', () => ({
  generateActivitySuggestions: (...args: unknown[]) => genMock(...args),
}))

beforeEach(() => genMock.mockReset())
afterEach(() => cleanup())

function renderIt() {
  return render(
    <LiveRegionProvider>
      <ActivitySuggestions />
    </LiveRegionProvider>,
  )
}

describe('ActivitySuggestions — AI 표시 라벨', () => {
  it('처음부터 당사자용 AI 표시 라벨과 덧붙임을 보여준다', () => {
    renderIt()
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(AI_NOTICE_PARTICIPANT.activity)
    expect(note).toHaveTextContent('하고 싶은 게 있으면 선생님에게 말해 주세요.')
  })

  it('제안이 뜬 뒤에도 라벨이 한 번만 보이고, 옛 임시 문구는 없다', async () => {
    genMock.mockResolvedValue({
      suggestions: [{ domainId: 'd1', title: '도서관 가기', why: '책을 좋아해요.', estCost: 0 }],
    })
    const user = userEvent.setup()
    renderIt()
    await user.click(screen.getByRole('button', { name: '활동 추천받기' }))

    await waitFor(() => expect(screen.getByText('도서관 가기')).toBeInTheDocument())
    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(screen.queryByText(/컴퓨터가 만든 참고예요/)).toBeNull()
  })

  it('라벨은 라이브 영역 밖의 정적 글이다(말로 알리는 채널은 전역 announce 하나)', async () => {
    genMock.mockResolvedValue({ suggestions: [] })
    const user = userEvent.setup()
    renderIt()
    await user.click(screen.getByRole('button', { name: '활동 추천받기' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('지금은 추천할 활동을 찾지 못했어요.'))
    expect(screen.getByRole('status')).not.toHaveTextContent(AI_NOTICE_PARTICIPANT.activity)
    expect(screen.getByRole('note').closest('[aria-live]')).toBeNull()
  })
})
