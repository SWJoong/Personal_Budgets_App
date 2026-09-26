import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import EvaluationForm from './EvaluationForm'
import { saveEvaluation, type EvaluationContext } from '@/app/actions/evaluation'

/**
 * 월별 평가 양식 렌더·배선 계약. 설계: supabase/seoul/20_evaluations.sql
 * (사용자 결정 2026-09-25 — 당사자 평가=실무자 대필 · 계획 이행 정도=계획 항목별).
 * 단언 범위: 4개 섹션, 저장값 프리필(KST 저장 시각), 저장 페이로드(선택 항목·지운 항목),
 * 저장 중 입력 잠금, 저장/더티 알림, 오류, 다른 계획 항목 표시, 선택 라디오 포커스 링, 저장 후 포커스.
 */

const { announce } = vi.hoisted(() => ({ announce: vi.fn() }))
vi.mock('@/components/ui/LiveRegion', () => ({
  useToast: () => ({ announce }),
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
      { id: 'rs-art', priority: 1, serviceName: '미술 활동', estimatedCost: 300000, monthSpent: 15000, otherPlan: false },
      { id: 'rs-swim', priority: 2, serviceName: '수영 강습', estimatedCost: null, monthSpent: 0, otherPlan: false },
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

const saved = (over: Partial<EvaluationContext> = {}) =>
  ctx({
    evaluation: {
      id: 'ev-1',
      budgetUsageNote: '재료 구입',
      participantOpinion: '재미있었어요',
      overallNote: '잘 진행됨',
      updatedAt: '2026-09-20T03:00:00Z', // KST 2026.09.20 12:00
    },
    itemEvaluations: [{ requestedServiceId: 'rs-art', achievement: 'achieved', note: '매주 참여' }],
    ...over,
  })

beforeEach(() => {
  announce.mockClear()
  vi.mocked(saveEvaluation).mockReset()
  vi.mocked(saveEvaluation).mockResolvedValue({ success: true, evaluationId: 'ev-1' })
})

describe('EvaluationForm — 월별 평가 양식', () => {
  it('4개 섹션·쓴 돈·계획 항목별 4단계 선택지가 보인다', () => {
    render(<EvaluationForm context={ctx()} onSaved={vi.fn()} />)
    for (const name of ['① 월별 예산 사용 평가', '② 계획 이행 정도', '③ 당사자가 직접 한 평가', '④ 종합 소견']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByText('18,000원').length).toBeGreaterThan(0)
    const art = screen.getByRole('group', { name: '1. 미술 활동' })
    expect(within(art).getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByText('아직 작성하지 않은 달이에요.')).toBeInTheDocument()
  })

  it('저장값이 미리 채워지고, 마지막 저장 시각은 한국 시간으로 보인다', () => {
    render(<EvaluationForm context={saved()} onSaved={vi.fn()} />)
    const art = screen.getByRole('group', { name: '1. 미술 활동' })
    expect(within(art).getByRole('radio', { name: '이행' })).toBeChecked()
    expect(screen.getByDisplayValue('재미있었어요')).toBeInTheDocument()
    expect(screen.getByDisplayValue('매주 참여')).toBeInTheDocument()
    expect(screen.getByText('마지막 저장 2026.09.20 12:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '평가 고쳐서 저장' })).toBeInTheDocument()
  })

  it('저장 시 선택한 항목만 보내고, 저장·더티 상태를 부모에 알린다', async () => {
    const onSaved = vi.fn()
    const onSavingChange = vi.fn()
    const onDirtyChange = vi.fn()
    render(
      <EvaluationForm context={ctx()} onSaved={onSaved} onSavingChange={onSavingChange} onDirtyChange={onDirtyChange} />,
    )
    const swim = screen.getByRole('group', { name: '2. 수영 강습' })
    fireEvent.click(within(swim).getByRole('radio', { name: '부분 이행' }))
    fireEvent.change(screen.getByLabelText(/그대로 적어 주세요/), { target: { value: '물이 무서웠지만 재밌었어요' } })
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: '평가 저장' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(saveEvaluation).toHaveBeenCalledWith({
      participantId: 'p-1',
      period: '2026-09',
      budgetUsageNote: '',
      participantOpinion: '물이 무서웠지만 재밌었어요',
      overallNote: '',
      items: [{ requestedServiceId: 'rs-swim', achievement: 'partial', note: '' }],
      clearedItemIds: [],
    })
    // 성공 시 잠금 해제는 부모가 새로고침을 마친 뒤 한다 — 양식은 true 만 알린다.
    expect(onSavingChange).toHaveBeenCalledTimes(1)
    expect(onSavingChange).toHaveBeenCalledWith(true)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('지우기는 화면에 보인 항목만 대상으로 한다(안 보인 기존 이행도는 건드리지 않음)', async () => {
    render(
      <EvaluationForm
        context={saved({
          itemEvaluations: [
            { requestedServiceId: 'rs-art', achievement: 'achieved', note: null },
            { requestedServiceId: 'rs-hidden', achievement: 'partial', note: null }, // planItems 에 없음
          ],
        })}
        onSaved={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '미술 활동 이행 정도 선택 지우기' }))
    fireEvent.click(screen.getByRole('button', { name: '평가 고쳐서 저장' }))
    await waitFor(() => expect(saveEvaluation).toHaveBeenCalledTimes(1))
    expect(vi.mocked(saveEvaluation).mock.calls[0][0].clearedItemIds).toEqual(['rs-art'])
  })

  it('부모가 잠그면(locked) 입력과 저장 버튼이 막힌다', () => {
    render(<EvaluationForm context={ctx()} onSaved={vi.fn()} locked />)
    expect(screen.getByLabelText(/그대로 적어 주세요/)).toBeDisabled()
    expect(screen.getByRole('button', { name: '평가 저장' })).toBeDisabled()
  })

  it('저장된 이행도를 "선택 지우기"로 되돌리면 지운 항목으로 보낸다', async () => {
    render(<EvaluationForm context={saved()} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '미술 활동 이행 정도 선택 지우기' }))
    const art = screen.getByRole('group', { name: '1. 미술 활동' })
    expect(within(art).getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '평가 고쳐서 저장' }))
    await waitFor(() => expect(saveEvaluation).toHaveBeenCalledTimes(1))
    expect(vi.mocked(saveEvaluation).mock.calls[0][0]).toMatchObject({ items: [], clearedItemIds: ['rs-art'] })
  })

  it('저장 중에는 입력이 잠긴다(저장 뒤 다시 마운트될 때 입력이 사라지지 않게)', async () => {
    let finish: (v: { success: true; evaluationId: string }) => void = () => {}
    vi.mocked(saveEvaluation).mockImplementationOnce(() => new Promise((res) => (finish = res)))
    render(<EvaluationForm context={ctx()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/그대로 적어 주세요/), { target: { value: '말' } })
    fireEvent.click(screen.getByRole('button', { name: '평가 저장' }))
    await waitFor(() => expect(screen.getByLabelText(/그대로 적어 주세요/)).toBeDisabled())
    await act(async () => finish({ success: true, evaluationId: 'ev-1' }))
    await waitFor(() => expect(screen.getByLabelText(/그대로 적어 주세요/)).toBeEnabled())
  })

  it('저장 실패는 오류로 알리고 onSaved 를 부르지 않는다', async () => {
    vi.mocked(saveEvaluation).mockResolvedValueOnce({ error: '적어도 한 칸은 채워 주세요.' })
    const onSaved = vi.fn()
    const onSavingChange = vi.fn()
    render(<EvaluationForm context={ctx()} onSaved={onSaved} onSavingChange={onSavingChange} />)
    fireEvent.click(screen.getByRole('button', { name: '평가 저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('적어도 한 칸은 채워 주세요.')
    expect(onSaved).not.toHaveBeenCalled()
    expect(onSavingChange).toHaveBeenLastCalledWith(false)
    // 오류는 인라인 role=alert 한 채널로만 — 전역 announce 까지 부르면 스크린리더가 두 번 읽는다.
    expect(announce).not.toHaveBeenCalled()
  })

  it('승인된 계획 항목이 없으면 안내만 보인다', () => {
    render(<EvaluationForm context={ctx({ planItems: [], planPeriod: null })} onSaved={vi.fn()} />)
    expect(screen.getByText(/승인된 이용계획 항목이 없어요/)).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('기준 계획 밖에 이미 평가된 항목은 "다른 계획의 항목"으로 표시한다(숨기지 않음)', () => {
    render(
      <EvaluationForm
        context={ctx({
          planItems: [{ id: 'rs-old', priority: 1, serviceName: '옛 요리 교실', estimatedCost: null, monthSpent: 0, otherPlan: true }],
        })}
        onSaved={vi.fn()}
      />,
    )
    expect(screen.getByText('(다른 계획의 항목)')).toBeInTheDocument()
  })

  it('선택된 라디오도 키보드 포커스가 보이도록 라벨에 대체 포커스 링이 있다(KWCAG 6.1.2)', () => {
    render(<EvaluationForm context={saved()} onSaved={vi.fn()} />)
    const checked = within(screen.getByRole('group', { name: '1. 미술 활동' })).getByRole('radio', { name: '이행' })
    const label = checked.closest('label')!
    expect(label.className).toContain('has-[:focus-visible]:outline-foreground')
    expect(label.className).toContain('has-[:focus-visible]:outline-offset-2')
  })

  it('focusStatusOnMount 이면 마운트 때 "마지막 저장" 줄로 포커스를 옮긴다', () => {
    render(<EvaluationForm context={saved()} onSaved={vi.fn()} focusStatusOnMount />)
    expect(document.activeElement).toBe(screen.getByText('마지막 저장 2026.09.20 12:00'))
  })
})
