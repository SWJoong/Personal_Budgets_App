'use client'

import { useState, useTransition } from 'react'
import {
  upsertSupportGoal,
  deleteSupportGoal,
  reorderSupportGoals,
  type SupportGoal,
  type SupportGoalInput,
} from '@/app/actions/supportGoal'

interface Props {
  carePlanId: string
  participantId: string
  initialGoals: SupportGoal[]
}

interface Draft {
  id?: string
  order_index: number
  support_area: string
  is_to_goal: boolean
  is_for_whom: boolean
  needed_support: string
  outcome_goal: string
  strategy: string
  linked_services: string
  eval_tool: string
  eval_target: string
  is_active: boolean
  open: boolean
  dirty: boolean
}

function toDraft(g?: SupportGoal, order_index = 1): Draft {
  return {
    id: g?.id,
    order_index: g?.order_index ?? order_index,
    support_area: g?.support_area ?? '',
    is_to_goal: g?.is_to_goal ?? false,
    is_for_whom: g?.is_for_whom ?? false,
    needed_support: g?.needed_support ?? '',
    outcome_goal: g?.outcome_goal ?? '',
    strategy: g?.strategy ?? '',
    linked_services: g?.linked_services ?? '',
    eval_tool: g?.eval_tool ?? '',
    eval_target: g?.eval_target ?? '',
    is_active: g?.is_active ?? true,
    open: !g,
    dirty: false,
  }
}

const ACHIEVEMENT_COLOR: Record<string, string> = {
  achieved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  not_achieved: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

export default function SupportGoalsForm({ carePlanId, participantId, initialGoals }: Props) {
  const [isPending, startTransition] = useTransition()
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    [...initialGoals].sort((a, b) => a.order_index - b.order_index).map(g => toDraft(g))
  )
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canAdd = drafts.length < 10

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function nextOrder() {
    const used = new Set(drafts.map(d => d.order_index))
    for (let i = 1; i <= 10; i++) if (!used.has(i)) return i
    return drafts.length + 1
  }

  function update(idx: number, patch: Partial<Draft>) {
    setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, ...patch, dirty: true } : d))
  }

  function addDraft() {
    if (!canAdd) return
    setDrafts(prev => [...prev, toDraft(undefined, nextOrder())])
  }

  async function handleSave(idx: number) {
    const d = drafts[idx]
    if (!d.support_area.trim()) {
      showToast(false, '지원 영역을 입력해주세요.')
      return
    }
    const input: SupportGoalInput = {
      id: d.id,
      care_plan_id: carePlanId,
      participant_id: participantId,
      order_index: d.order_index,
      support_area: d.support_area,
      is_to_goal: d.is_to_goal,
      is_for_whom: d.is_for_whom,
      needed_support: d.needed_support || null,
      outcome_goal: d.outcome_goal || null,
      strategy: d.strategy || null,
      linked_services: d.linked_services || null,
      eval_tool: d.eval_tool || null,
      eval_target: d.eval_target || null,
      is_active: d.is_active,
    }
    startTransition(async () => {
      const result = await upsertSupportGoal(input)
      if (result.error) {
        showToast(false, result.error)
      } else {
        update(idx, { dirty: false, open: false })
        showToast(true, '목표가 저장되었습니다.')
      }
    })
  }

  async function handleDelete(idx: number) {
    const d = drafts[idx]
    if (!d.id) {
      setDrafts(prev => prev.filter((_, i) => i !== idx))
      return
    }
    setDeletingId(d.id)
  }

  async function confirmDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSupportGoal(id, participantId)
      if (result.error) {
        showToast(false, result.error)
      } else {
        setDrafts(prev => prev.filter(d => d.id !== id))
        showToast(true, '목표가 삭제되었습니다.')
      }
      setDeletingId(null)
    })
  }

  async function handleMoveUp(idx: number) {
    if (idx === 0) return
    const next = [...drafts]
    const [a, b] = [next[idx - 1], next[idx]]
    const tmp = a.order_index
    next[idx - 1] = { ...b, order_index: tmp, dirty: true }
    next[idx] = { ...a, order_index: b.order_index, dirty: true }
    setDrafts(next)
    const saved = next.filter(d => d.id).map(d => ({ id: d.id!, order_index: d.order_index }))
    if (saved.length > 0) {
      startTransition(async () => {
        await reorderSupportGoals(saved)
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold transition-all ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
            <p className="text-lg font-bold text-zinc-900 mb-2">정말 삭제하시겠어요?</p>
            <p className="text-sm text-zinc-500 mb-6">삭제된 목표는 되돌릴 수 없어요.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeletingId(null)}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors min-w-[80px]"
              >
                취소
              </button>
              <button
                onClick={() => confirmDelete(deletingId)}
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors min-w-[80px] disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {drafts.length === 0 && (
        <div className="bg-white rounded-2xl p-8 ring-1 ring-zinc-200 text-center text-zinc-400 text-sm">
          아직 등록된 목표가 없어요. 아래에서 추가해 주세요.
        </div>
      )}

      {drafts.map((d, idx) => (
        <div key={d.id ?? `new-${idx}`} className={`bg-white rounded-2xl ring-1 ${d.is_active ? 'ring-zinc-200' : 'ring-zinc-100 opacity-60'} shadow-sm overflow-hidden`}>
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-100 text-zinc-500 text-xs font-black flex items-center justify-center">
              {d.order_index}
            </span>
            <button
              onClick={() => update(idx, { open: !d.open })}
              className="flex-1 text-left text-sm font-bold text-zinc-900 truncate hover:text-zinc-600 transition-colors"
            >
              {d.support_area || <span className="text-zinc-400 font-normal italic">지원 영역을 입력하세요</span>}
            </button>
            {d.dirty && <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">미저장</span>}
            {!d.is_active && <span className="text-[10px] text-zinc-400 font-bold bg-zinc-100 px-2 py-0.5 rounded-full">비활성</span>}
            <div className="flex items-center gap-1">
              {idx > 0 && (
                <button onClick={() => handleMoveUp(idx)} className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-colors" title="위로">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 11V3M3 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              )}
              <button
                onClick={() => update(idx, { open: !d.open })}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`transition-transform ${d.open ? 'rotate-180' : ''}`}><path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>

          {/* 펼쳐진 폼 */}
          {d.open && (
            <div className="px-5 pb-5 border-t border-zinc-100 pt-4 flex flex-col gap-4">
              {/* 지원 영역 */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">지원 영역 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={d.support_area}
                  onChange={e => update(idx, { support_area: e.target.value })}
                  placeholder="예: 고용 활동, 평생학습"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* To / For 체크박스 */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.is_to_goal}
                    onChange={e => update(idx, { is_to_goal: e.target.checked })}
                    className="w-4 h-4 rounded accent-zinc-900"
                  />
                  <span className="text-sm text-zinc-700">당사자에게 중요한 것 (To)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.is_for_whom}
                    onChange={e => update(idx, { is_for_whom: e.target.checked })}
                    className="w-4 h-4 rounded accent-zinc-900"
                  />
                  <span className="text-sm text-zinc-700">당사자를 위해 중요한 것 (For)</span>
                </label>
              </div>

              {/* 2열 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ['needed_support', '필요한 지원'],
                  ['outcome_goal', '성과 및 산출 목표'],
                  ['strategy', '전략 계획 (누가, 언제, 어떻게)'],
                  ['linked_services', '연계 가능한 지원'],
                  ['eval_tool', '평가 도구'],
                  ['eval_target', '목표치'],
                ] as [keyof Draft, string][]).map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-xs font-bold text-zinc-500 mb-1">{label}</label>
                    <textarea
                      value={(d[field] as string) ?? ''}
                      onChange={e => update(idx, { [field]: e.target.value } as Partial<Draft>)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                    />
                  </div>
                ))}
              </div>

              {/* 활성 여부 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={d.is_active}
                  onChange={e => update(idx, { is_active: e.target.checked })}
                  className="w-4 h-4 rounded accent-zinc-900"
                />
                <span className="text-sm text-zinc-600">활성 목표 (비활성 시 평가에서 숨겨집니다)</span>
              </label>

              {/* 버튼 */}
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() => handleDelete(idx)}
                  className="text-sm text-red-500 hover:text-red-700 font-bold transition-colors"
                >
                  삭제
                </button>
                <button
                  onClick={() => handleSave(idx)}
                  disabled={isPending || !d.dirty}
                  className="px-5 py-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-40"
                >
                  {isPending ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 추가 버튼 */}
      <button
        onClick={addDraft}
        disabled={!canAdd || isPending}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-400 text-sm font-bold hover:border-zinc-500 hover:text-zinc-600 transition-colors disabled:opacity-40"
      >
        + 목표 추가 ({drafts.length}/10)
      </button>
    </div>
  )
}
