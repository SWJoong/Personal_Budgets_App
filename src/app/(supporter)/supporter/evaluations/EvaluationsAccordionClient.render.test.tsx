import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EvaluationsAccordionClient from './EvaluationsAccordionClient'
import { getEvaluationContext, type EvaluationContext } from '@/app/actions/evaluation'

/**
 * 계획·평가 당사자별 펼쳐보기(아코디언) 계약. 사용자 요청 2026-09-25.
 * 단언 범위: 목록 시맨틱·요약, 펼치면 해당 당사자·기본 달로 불러와 양식 표시, 한 명만 펼침,
 * 같은 달 재펼침은 다시 부르지 않음, 달 이동 시 그 달로 다시 부름, 오류 표시.
 */

vi.mock('@/components/ui/LiveRegion', () => ({
  useToast: () => ({ announce: vi.fn() }),
}))
vi.mock('@/app/actions/evaluation', () => ({
  getEvaluationContext: vi.fn(),
  saveEvaluation: vi.fn(),
}))

function ctx(participantId: string, period: string): EvaluationContext {
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
  }
}

const participants = [
  { id: 'p-1', name: '김지수', latestPeriod: '2026-08' },
  { id: 'p-2', name: '박준호', latestPeriod: null },
]

beforeEach(() => {
  vi.mocked(getEvaluationContext).mockReset()
  vi.mocked(getEvaluationContext).mockImplementation(async (pid: string, period: string) => ({ context: ctx(pid, period) }))
})

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
    render(<EvaluationsAccordionClient participants={participants} defaultPeriod="2026-09" />)
    const jisu = screen.getByRole('button', { name: /김지수/ })
    fireEvent.click(jisu)
    expect(jisu).toHaveAttribute('aria-expanded', 'true')
    expect(getEvaluationContext).toHaveBeenCalledWith('p-1', '2026-09')
    expect(await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })).toBeInTheDocument()
  })

  it('한 번에 한 명만 펼치고, 같은 달을 다시 펼치면 다시 부르지 않는다', async () => {
    render(<EvaluationsAccordionClient participants={participants} defaultPeriod="2026-09" />)
    const jisu = screen.getByRole('button', { name: /김지수/ })
    const junho = screen.getByRole('button', { name: /박준호/ })
    fireEvent.click(jisu)
    await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })
    fireEvent.click(junho)
    expect(jisu).toHaveAttribute('aria-expanded', 'false')
    expect(junho).toHaveAttribute('aria-expanded', 'true')
    expect(getEvaluationContext).toHaveBeenCalledWith('p-2', '2026-09')
    await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })
    fireEvent.click(jisu) // 김지수 다시 — 같은 달은 캐시
    await screen.findByRole('heading', { name: '① 월별 예산 사용 평가' })
    expect(getEvaluationContext).toHaveBeenCalledTimes(2)
  })

  it('양식에서 이전 달로 옮기면 그 달로 다시 부른다', async () => {
    render(<EvaluationsAccordionClient participants={participants} defaultPeriod="2026-09" />)
    fireEvent.click(screen.getByRole('button', { name: /김지수/ }))
    const prev = await screen.findByRole('button', { name: '이전 달' })
    await waitFor(() => expect(prev).toBeEnabled())
    fireEvent.click(prev)
    await waitFor(() => expect(getEvaluationContext).toHaveBeenLastCalledWith('p-1', '2026-08'))
    expect(await screen.findByText('2026년 8월 평가')).toBeInTheDocument()
  })

  it('불러오기 실패는 오류로 알린다', async () => {
    vi.mocked(getEvaluationContext).mockResolvedValueOnce({ error: '평가 저장소가 아직 준비되지 않았어요. 관리자에게 알려 주세요.' })
    render(<EvaluationsAccordionClient participants={participants} defaultPeriod="2026-09" />)
    fireEvent.click(screen.getByRole('button', { name: /김지수/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('평가 저장소가 아직 준비되지 않았어요')
  })
})
