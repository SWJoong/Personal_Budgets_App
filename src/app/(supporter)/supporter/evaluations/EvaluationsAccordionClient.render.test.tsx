import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import EvaluationsAccordionClient from './EvaluationsAccordionClient'
import { getEvaluationContext, saveEvaluation, type EvaluationContext } from '@/app/actions/evaluation'

/**
 * 계획·평가 당사자별 펼쳐보기(아코디언) 계약. 사용자 요청 2026-09-25.
 * 단언 범위: 목록·요약, 펼치면 기본 달로 불러와 양식 표시, 한 명만 펼침·같은 달 캐시, 달 이동(패널 고정 →
 * 포커스 유지·안내), 미래 달 막기, 오류 재시도, 저장 중 잠금·저장 후 서버값으로 다시 마운트, 이탈 확인.
 */

const { announce } = vi.hoisted(() => ({ announce: vi.fn() }))
vi.mock('@/components/ui/LiveRegion', () => ({
  useToast: () => ({ announce }),
}))
vi.mock('@/app/actions/evaluation', () => ({
  getEvaluationContext: vi.fn(),
  saveEvaluation: vi.fn(),
}))

function ctx(participantId: string, period: string, over: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    participantId,
    period,
    planPeriod: null,
    planItems: [],
    usage: {
      spent: 0,
      count: 0,
      byStatus: {
        pending: { count: 0, amount: 0 },
        accepted: { count: 0, amount: 0 },
        rejected: { count: 0, amount: 0 },
        recovered: { count: 0, amount: 0 },
      },
    },
    evaluation: null,
    itemEvaluations: [],
    recentPeriods: [],
    ...over,
  }
}

const participants = [
  { id: 'p-1', name: '김지수', latestPeriod: '2026-08' },
  { id: 'p-2', name: '박준호', latestPeriod: null },
]

beforeEach(() => {
  announce.mockClear()
  vi.mocked(getEvaluationContext).mockReset()
  vi.mocked(getEvaluationContext).mockImplementation(async (pid: string, period: string) => ({ context: ctx(pid, period) }))
  vi.mocked(saveEvaluation).mockReset()
})
afterEach(() => vi.restoreAllMocks())

async function openJisu() {
  render(<EvaluationsAccordionClient participants={participants} defaultPeriod="2026-09" />)
  fireEvent.click(screen.getByRole('button', { name: /김지수/ }))
  await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })
}

describe('EvaluationsAccordionClient — 당사자별 펼쳐보기', () => {
  it('당사자마다 접힌 목록 항목과 최근 평가 요약이 보인다', () => {
    render(<EvaluationsAccordionClient participants={participants} defaultPeriod="2026-09" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    const jisu = screen.getByRole('button', { name: /김지수/ })
    expect(jisu).toHaveAttribute('aria-expanded', 'false')
    expect(jisu).toHaveTextContent('최근 평가 2026년 8월')
    expect(screen.getByRole('button', { name: /박준호/ })).toHaveTextContent('평가 없음')
    expect(getEvaluationContext).not.toHaveBeenCalled()
  })

  it('펼치면 그 당사자의 기본 달을 불러와 양식을 보여준다', async () => {
    await openJisu()
    expect(screen.getByRole('button', { name: /김지수/ })).toHaveAttribute('aria-expanded', 'true')
    expect(getEvaluationContext).toHaveBeenCalledWith('p-1', '2026-09')
    expect(screen.getByText('2026년 9월 평가')).toBeInTheDocument()
  })

  it('한 번에 한 명만 펼치고, 같은 달을 다시 펼치면 다시 부르지 않는다', async () => {
    await openJisu()
    const jisu = screen.getByRole('button', { name: /김지수/ })
    const junho = screen.getByRole('button', { name: /박준호/ })
    fireEvent.click(junho)
    expect(jisu).toHaveAttribute('aria-expanded', 'false')
    expect(junho).toHaveAttribute('aria-expanded', 'true')
    expect(getEvaluationContext).toHaveBeenCalledWith('p-2', '2026-09')
    await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })
    fireEvent.click(jisu)
    await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })
    expect(getEvaluationContext).toHaveBeenCalledTimes(2)
  })

  it('이전 달로 옮기면 그 달을 불러오고, 누른 버튼이 남아 포커스를 잃지 않으며 안내한다', async () => {
    await openJisu()
    const prev = screen.getByRole('button', { name: '이전 달' })
    prev.focus()
    fireEvent.click(prev)
    await waitFor(() => expect(getEvaluationContext).toHaveBeenLastCalledWith('p-1', '2026-08'))
    expect(await screen.findByText('2026년 8월 평가')).toBeInTheDocument()
    await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '이전 달' }))
    expect(announce).toHaveBeenCalledWith('2026년 8월 평가를 불러왔어요.')
  })

  it('이번 달에서는 다음 달로 갈 수 없다(미래 달 평가 방지)', async () => {
    await openJisu()
    const next = screen.getByRole('button', { name: /다음 달/ })
    expect(next).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(next)
    expect(getEvaluationContext).toHaveBeenCalledTimes(1)
  })

  it('불러오기 실패는 캐시하지 않고 "다시 불러오기"와 다시 펼치기로 재시도한다', async () => {
    vi.mocked(getEvaluationContext)
      .mockResolvedValueOnce({ error: '평가를 불러오지 못했어요: 네트워크' })
      .mockResolvedValueOnce({ error: '평가를 불러오지 못했어요: 네트워크' })
    render(<EvaluationsAccordionClient participants={participants} defaultPeriod="2026-09" />)
    const jisu = screen.getByRole('button', { name: /김지수/ })
    fireEvent.click(jisu)
    expect(await screen.findByRole('alert')).toHaveTextContent('네트워크')
    fireEvent.click(jisu) // 접기
    fireEvent.click(jisu) // 다시 펼치기 → 재요청(두 번째도 실패)
    await waitFor(() => expect(getEvaluationContext).toHaveBeenCalledTimes(2))
    fireEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }))
    await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })
    expect(getEvaluationContext).toHaveBeenCalledTimes(3)
  })

  it('저장 중에는 헤더가 잠기고, 저장 뒤 서버값으로 양식이 다시 마운트된다', async () => {
    let finish: (v: { success: true; evaluationId: string }) => void = () => {}
    vi.mocked(saveEvaluation).mockImplementationOnce(() => new Promise((res) => (finish = res)))
    await openJisu()
    fireEvent.change(screen.getByLabelText(/그대로 적어 주세요/), { target: { value: '새로 적은 말' } })
    // 저장 후 새로고침은 서버에 저장된 값을 돌려준다.
    vi.mocked(getEvaluationContext).mockImplementation(async (pid: string, period: string) => ({
      context: ctx(pid, period, {
        evaluation: {
          id: 'ev-1',
          budgetUsageNote: '',
          participantOpinion: '새로 적은 말',
          overallNote: '',
          updatedAt: '2026-09-25T05:03:00Z',
        },
      }),
    }))
    fireEvent.click(screen.getByRole('button', { name: '평가 저장' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /김지수/ })).toBeDisabled())
    await act(async () => finish({ success: true, evaluationId: 'ev-1' }))
    expect(await screen.findByText('마지막 저장 2026.09.25 14:03')).toBeInTheDocument()
    expect(screen.getByDisplayValue('새로 적은 말')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /김지수/ })).toBeEnabled()
    expect(document.activeElement).toBe(screen.getByText('마지막 저장 2026.09.25 14:03'))
  })

  it('저장하지 않은 입력이 있으면 달 이동 전에 확인하고, 취소하면 그대로 남는다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await openJisu()
    fireEvent.change(screen.getByLabelText(/그대로 적어 주세요/), { target: { value: '길게 대필 중' } })
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(getEvaluationContext).toHaveBeenCalledTimes(1)
    expect(screen.getByDisplayValue('길게 대필 중')).toBeInTheDocument()

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: /박준호/ }))
    expect(confirm).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(getEvaluationContext).toHaveBeenLastCalledWith('p-2', '2026-09'))
  })
})
