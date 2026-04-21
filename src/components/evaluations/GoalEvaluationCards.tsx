'use client'

import { useState, useTransition } from 'react'
import {
  upsertGoalEvaluationsBatch,
  type GoalEvaluation,
  type GoalEvaluationInput,
  type AchievementStatus,
} from '@/app/actions/goalEvaluation'
import type { SupportGoal } from '@/app/actions/supportGoal'

interface Props {
  evaluationId: string
  participantId: string
  goals: SupportGoal[]
  initialEvaluations: GoalEvaluation[]
}

interface DraftCard {
  id?: string
  support_goal_id: string
  tried: string
  achievement: AchievementStatus | ''
  learned: string
  satisfied: string
  dissatisfied: string
  next_plan: string
  target_value: string
  actual_value: string
  dirty: boolean
}

function toDraft(goal: SupportGoal, existing?: GoalEvaluation): DraftCard {
  return {
    id: existing?.id,
    support_goal_id: goal.id,
    tried: existing?.tried ?? '',
    achievement: existing?.achievement ?? '',
    learned: existing?.learned ?? '',
    satisfied: existing?.satisfied ?? '',
    dissatisfied: existing?.dissatisfied ?? '',
    next_plan: existing?.next_plan ?? '',
    target_value: existing?.target_value != null ? String(existing.target_value) : '',
    actual_value: existing?.actual_value != null ? String(existing.actual_value) : '',
    dirty: false,
  }
}

const ACHIEVEMENT_OPTIONS: { value: AchievementStatus; label: string; icon: string; cls: string }[] = [
  { value: 'achieved', label: '달성', icon: '✓', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'in_progress', label: '진행 중', icon: '▶', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'not_achieved', label: '미달성', icon: '—', cls: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
]

export default function GoalEvaluationCards({
  evaluationId,
  participantId,
  goals,
  initialEvaluations,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [cards, setCards] = useState<DraftCard[]>(() =>
    goals
      .filter(g => g.is_active)
      .sort((a, b) => a.order_index - b.order_index)
      .map(g => {
        const existing = initialEvaluations.find(e => e.support_goal_id === g.id)
        return toDraft(g, existing)
      })
  )
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [activeCard, setActiveCard] = useState<number>(0)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function updateCard(idx: number, patch: Partial<DraftCard>) {
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, ...patch, dirty: true } : c))
  }

  async function handleSaveAll() {
    const inputs: GoalEvaluationInput[] = cards.map(c => ({
      id: c.id,
      evaluation_id: evaluationId,
      support_goal_id: c.support_goal_id,
      tried: c.tried || null,
      achievement: (c.achievement as AchievementStatus) || null,
      learned: c.learned || null,
      satisfied: c.satisfied || null,
      dissatisfied: c.dissatisfied || null,
      next_plan: c.next_plan || null,
      target_value: c.target_value ? parseFloat(c.target_value) : null,
      actual_value: c.actual_value ? parseFloat(c.actual_value) : null,
    }))

    startTransition(async () => {
      const result = await upsertGoalEvaluationsBatch(inputs, participantId)
      if (result.error) {
        showToast(false, result.error)
      } else {
        setCards(prev => prev.map(c => ({ ...c, dirty: false })))
        showToast(true, '모든 목표 평가가 저장되었습니다.')
      }
    })
  }

  async function handleSaveCard(idx: number) {
    const c = cards[idx]
    const inputs: GoalEvaluationInput[] = [{
      id: c.id,
      evaluation_id: evaluationId,
      support_goal_id: c.support_goal_id,
      tried: c.tried || null,
      achievement: (c.achievement as AchievementStatus) || null,
      learned: c.learned || null,
      satisfied: c.satisfied || null,
      dissatisfied: c.dissatisfied || null,
      next_plan: c.next_plan || null,
      target_value: c.target_value ? parseFloat(c.target_value) : null,
      actual_value: c.actual_value ? parseFloat(c.actual_value) : null,
    }]

    startTransition(async () => {
      const result = await upsertGoalEvaluationsBatch(inputs, participantId)
      if (result.error) {
        showToast(false, result.error)
      } else {
        updateCard(idx, { dirty: false })
        showToast(true, '저장되었습니다.')
      }
    })
  }

  const goalMap = new Map(goals.map(g => [g.id, g]))
  const dirtyCount = cards.filter(c => c.dirty).length

  if (cards.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 ring-1 ring-zinc-200 text-center text-zinc-400 text-sm">
        활성화된 지원 목표가 없어요. 목표를 먼저 등록해 주세요.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {cards.map((c, idx) => {
          const goal = goalMap.get(c.support_goal_id)
          const achieveOpt = ACHIEVEMENT_OPTIONS.find(a => a.value === c.achievement)
          return (
            <button
              key={c.support_goal_id}
              onClick={() => setActiveCard(idx)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                activeCard === idx
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white ring-1 ring-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <span className="text-xs opacity-60">{goal?.order_index}.</span>
              <span className="max-w-[80px] truncate">{goal?.support_area ?? '목표'}</span>
              {achieveOpt && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-black ${achieveOpt.cls}`}>
                  {achieveOpt.icon}
                </span>
              )}
              {c.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </button>
          )
        })}
      </div>

      {/* 활성 카드 */}
      {cards.map((c, idx) => {
        if (idx !== activeCard) return null
        const goal = goalMap.get(c.support_goal_id)
        return (
          <div key={c.support_goal_id} className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
            {/* 카드 헤더 */}
            <div className="px-6 py-5 bg-zinc-50 border-b border-zinc-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">
                    목표 {goal?.order_index} — {goal?.support_area}
                  </p>
                  {goal?.outcome_goal && (
                    <p className="text-sm text-zinc-600">{goal.outcome_goal}</p>
                  )}
                </div>
                {/* 달성도 선택 */}
                <div className="flex gap-1.5 flex-shrink-0">
                  {ACHIEVEMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateCard(idx, { achievement: opt.value })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                        c.achievement === opt.value ? opt.cls : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 목표치 / 실적 */}
              {(goal?.eval_target || goal?.eval_tool) && (
                <div className="flex gap-4 mt-3">
                  {goal.eval_tool && (
                    <span className="text-xs text-zinc-500">평가 도구: {goal.eval_tool}</span>
                  )}
                  {goal.eval_target && (
                    <span className="text-xs text-zinc-500">목표치: {goal.eval_target}</span>
                  )}
                </div>
              )}

              {/* 정량 지표 */}
              <div className="flex gap-3 mt-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-zinc-500">목표값</label>
                  <input
                    type="number"
                    value={c.target_value}
                    onChange={e => updateCard(idx, { target_value: e.target.value })}
                    placeholder="예: 10"
                    className="w-24 px-2 py-1 rounded-lg border border-zinc-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-zinc-500">실제값</label>
                  <input
                    type="number"
                    value={c.actual_value}
                    onChange={e => updateCard(idx, { actual_value: e.target.value })}
                    placeholder="예: 8"
                    className="w-24 px-2 py-1 rounded-lg border border-zinc-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>
            </div>

            {/* 4+1 평가 폼 */}
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ['tried', '무엇을 했나요?', '이 목표를 위해 한 활동을 적어요'],
                ['learned', '무엇을 배웠나요?', '당사자가 경험하고 배운 것'],
                ['satisfied', '잘 된 점', '긍정적인 변화나 성과'],
                ['dissatisfied', '아쉬운 점', '개선이 필요한 부분'],
                ['next_plan', '다음 계획', '앞으로 어떻게 지원할까요?'],
              ] as [keyof DraftCard, string, string][]).map(([field, label, placeholder]) => (
                <div key={field} className={field === 'tried' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">{label}</label>
                  <textarea
                    value={(c[field] as string) ?? ''}
                    onChange={e => updateCard(idx, { [field]: e.target.value } as Partial<DraftCard>)}
                    placeholder={placeholder}
                    rows={field === 'tried' ? 3 : 2}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none leading-relaxed"
                  />
                </div>
              ))}
            </div>

            {/* 카드 하단 버튼 */}
            <div className="px-6 pb-5 flex justify-between items-center border-t border-zinc-100 pt-4">
              <div className="flex gap-2">
                {idx > 0 && (
                  <button onClick={() => setActiveCard(idx - 1)} className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors">← 이전 목표</button>
                )}
                {idx < cards.length - 1 && (
                  <button onClick={() => setActiveCard(idx + 1)} className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors">다음 목표 →</button>
                )}
              </div>
              <button
                onClick={() => handleSaveCard(idx)}
                disabled={isPending || !c.dirty}
                className="px-5 py-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                이 목표 저장
              </button>
            </div>
          </div>
        )
      })}

      {/* 전체 저장 */}
      {dirtyCount > 0 && (
        <button
          onClick={handleSaveAll}
          disabled={isPending}
          className="w-full py-3 rounded-2xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {isPending ? '저장 중...' : `전체 저장 (${dirtyCount}개 변경)`}
        </button>
      )}
    </div>
  )
}
