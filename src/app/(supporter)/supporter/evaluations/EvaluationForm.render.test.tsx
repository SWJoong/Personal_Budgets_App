import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import EvaluationForm from './EvaluationForm'
import { saveEvaluation, type EvaluationContext } from '@/app/actions/evaluation'

/**
 * 월별 평가 양식 렌더·배선 계약. 설계: supabase/seoul/20_evaluations.sql
 * (사용자 결정 2026-09-25 — 당사자 평가=실무자 대필 · 계획 이행 정도=계획 항목별).
 * 단언 범위: 4개 섹션 노출, 저장값 프리필, 저장 페이로드(선택한 항목만), 오류 표시, 달 이동.
 */

vi.mock('@/components/ui/LiveRegion', () => ({
  useToast: () => ({ announce: vi.fn() }),
}))
vi.mock('@/app/actions/evaluation', () => ({
  saveEvaluation: vi.fn(async () => ({ success: true, evaluationId: 'ev-1' })),
  getEvaluationContext: vi.fn(),
}))

function ctx(over: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    participantId: 'p-1',
    period: '2026-09',
    planPeriod: { start: '2026-07-01', end: '2026-12-31' },
    planItems: [
      { id: 'rs-art', priority: 1, serviceName: '미술 활동', estimatedCost: 300000, monthSpent: 15000 },
      { id: 'rs-swim', priority: 2, serviceName: '수영 강습', estimatedCost: null, monthSpent: 0 },
    ],
    usage: {
      spent: 18000,
      count: 3,
      byStatus: {
        pending: { count: 1, amount: 10000 },
        accepted: { count: 1, amount: 5000 },
        rejected: { count: 1, amount: 3000 },
        recovered: { count: 0, amount: 0 },
      },
    },
    evaluation: null,
    itemEvaluations: [],
    recentPeriods: [],
    ...over,
  }
}

beforeEach(() => {
  vi.mocked(saveEvaluation).mockClear()
  vi.mocked(saveEvaluation).mockResolvedValue({ success: true, evaluationId: 'ev-1' })
})

describe('EvaluationForm — 월별 평가 양식', () => {
  it('4개 섹션·달·쓴 돈·계획 항목별 4단계 선택지가 보인다', () => {
    render(<EvaluationForm context={ctx()} onChangePeriod={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText('2026년 9월 평가')).toBeInTheDocument()
    for (const name of ['① 월별 예산 사용 평가', '② 계획 이행 정도', '③ 당사자가 직접 한 평가', '④ 종합 소견']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByText('18,000원').length).toBeGreaterThan(0)
    const art = screen.getByRole('group', { name: '1. 미술 활동' })
    expect(within(art).getAllByRole('radio')).toHaveLength(4)
    expect(within(art).getByRole('radio', { name: '초과 달성' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '2. 수영 강습' })).toBeInTheDocument()
  })

  it('저장된 평가·항목 이행도가 미리 채워지고 버튼이 "고쳐서 저장"이 된다', () => {
    render(
      <EvaluationForm
        context={ctx({
          evaluation: {
            id: 'ev-1',
            budgetUsageNote: '재료 구입',
            participantOpinion: '재미있었어요',
            overallNote: '잘 진행됨',
            updatedAt: '2026-09-20T03:00:00Z',
          },
          itemEvaluations: [{ requestedServiceId: 'rs-art', achievement: 'achieved', note: '매주 참여' }],
        })}
        onChangePeriod={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    const art = screen.getByRole('group', { name: '1. 미술 활동' })
    expect(within(art).getByRole('radio', { name: '이행' })).toBeChecked()
    expect(within(art).getByRole('radio', { name: '부분 이행' })).not.toBeChecked()
    expect(screen.getByDisplayValue('재미있었어요')).toBeInTheDocument()
    expect(screen.getByDisplayValue('매주 참여')).toBeInTheDocument()
    expect(screen.getByText(/마지막 저장 2026\.09\.20/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '평가 고쳐서 저장' })).toBeInTheDocument()
  })

  it('저장 시 선택한 항목만, 서술과 함께 보낸다(대필 칸 포함)', async () => {
    const onSaved = vi.fn()
    render(<EvaluationForm context={ctx()} onChangePeriod={vi.fn()} onSaved={onSaved} />)
    const swim = screen.getByRole('group', { name: '2. 수영 강습' })
    fireEvent.click(within(swim).getByRole('radio', { name: '부분 이행' }))
    fireEvent.change(screen.getByLabelText(/그대로 적어 주세요/), { target: { value: '물이 무서웠지만 재밌었어요' } })
    fireEvent.click(screen.getByRole('button', { name: '평가 저장' }))

    await waitFor(() => expect(saveEvaluation).toHaveBeenCalledTimes(1))
    expect(saveEvaluation).toHaveBeenCalledWith({
      participantId: 'p-1',
      period: '2026-09',
      budgetUsageNote: '',
      participantOpinion: '물이 무서웠지만 재밌었어요',
      overallNote: '',
      items: [{ requestedServiceId: 'rs-swim', achievement: 'partial', note: '' }],
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('저장 실패는 오류로 알리고 onSaved 를 부르지 않는다', async () => {
    vi.mocked(saveEvaluation).mockResolvedValueOnce({ error: '적어도 한 칸은 채워 주세요.' })
    const onSaved = vi.fn()
    render(<EvaluationForm context={ctx()} onChangePeriod={vi.fn()} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: '평가 저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('적어도 한 칸은 채워 주세요.')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('승인된 계획 항목이 없으면 안내만 보인다', () => {
    render(<EvaluationForm context={ctx({ planItems: [], planPeriod: null })} onChangePeriod={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText(/승인된 이용계획 항목이 없어요/)).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('이전·다음 달 버튼은 달을 하나씩 옮긴다', () => {
    const onChangePeriod = vi.fn()
    render(<EvaluationForm context={ctx()} onChangePeriod={onChangePeriod} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(onChangePeriod).toHaveBeenNthCalledWith(1, '2026-08')
    expect(onChangePeriod).toHaveBeenNthCalledWith(2, '2026-10')
  })
})
