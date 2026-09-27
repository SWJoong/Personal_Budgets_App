import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveRegionProvider } from '@/components/ui/LiveRegion'
import { AI_NOTICE_TEXT } from '@/components/ui/AiNotice'
import EasyReadSummary from './EasyReadSummary'

/**
 * 쉬운 말 요약(실무자) — 공통 AI 표시 라벨(AiNotice staff) 소비 계약.
 * 요약은 틀릴 수 있어 화면별 덧붙임 '내용이 맞는지 꼭 확인하고 쓰세요.'를 같은 라벨 안에 유지한다.
 * 액션은 목킹(Anthropic 미호출).
 */

const genMock = vi.fn()
vi.mock('@/app/actions/easyReadSummary', () => ({
  generateEasyReadSummary: (...args: unknown[]) => genMock(...args),
}))

beforeEach(() => genMock.mockReset())
afterEach(() => cleanup())

function renderIt() {
  return render(
    <LiveRegionProvider>
      <EasyReadSummary planId="plan-1" />
    </LiveRegionProvider>,
  )
}

describe('EasyReadSummary — AI 표시 라벨', () => {
  it('실무자용 AI 표시 라벨 + 확인 후 사용 덧붙임을 보여준다', () => {
    renderIt()
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(AI_NOTICE_TEXT.staff)
    expect(note).toHaveTextContent('내용이 맞는지 꼭 확인하고 쓰세요.')
  })

  it('요약이 뜬 뒤에도 라벨이 한 번만 보이고, 옛 임시 문구는 없다', async () => {
    genMock.mockResolvedValue({ summary: '민수 님은 운동을 해요.' })
    const user = userEvent.setup()
    renderIt()
    await user.click(screen.getByRole('button', { name: '쉬운 말 요약 만들기' }))

    await waitFor(() => expect(screen.getByText('민수 님은 운동을 해요.')).toBeInTheDocument())
    expect(genMock).toHaveBeenCalledWith('plan-1')
    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(screen.queryByText(/컴퓨터가 만든 요약이에요/)).toBeNull()
    // 라벨은 정적 글 — 결과 알림(전역 status)에 섞여 두 번 읽히지 않는다.
    expect(screen.getByRole('status')).toHaveTextContent('쉬운 말 요약을 만들었어요.')
    expect(screen.getByRole('status')).not.toHaveTextContent(AI_NOTICE_TEXT.staff)
  })
})
