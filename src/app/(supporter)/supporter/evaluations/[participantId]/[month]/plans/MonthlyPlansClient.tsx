'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteMonthlyPlan,
  upsertMonthlyPlan,
  type MonthlyPlan,
} from '@/app/actions/monthlyPlan'

interface Props {
  participantId: string
  month: string                         // 'YYYY-MM-01'
  initialPlans: MonthlyPlan[]
  fundingSources: { id: string; name: string }[]
  supportGoals?: { id: string; support_area: string; order_index: number }[]
}

interface Draft {
  id?: string
  order_index: number
  title: string
  description: string
  funding_source_id: string
  support_goal_id: string
  planned_budget: string
  target_count: string
  scheduled_dates: string                // 쉼표로 구분된 'YYYY-MM-DD'
  dirty: boolean
}

function toDraft(p?: MonthlyPlan, order_index = 1): Draft {
  return {
    id: p?.id,
    order_index: p?.order_index ?? order_index,
    title: p?.title ?? '',
    description: p?.description ?? '',
    funding_source_id: p?.funding_source_id ?? '',
    support_goal_id: p?.support_goal_id ?? '',
    planned_budget: p ? String(p.planned_budget ?? '') : '',
    target_count: p?.target_count != null ? String(p.target_count) : '',
    scheduled_dates: (p?.scheduled_dates || []).join(', '),
    dirty: false,
  }
}

export default function MonthlyPlansClient({
  participantId,
  month,
  initialPlans,
  fundingSources,
  supportGoals = [],
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [drafts, setDrafts] = useState<Draft[]>(
    () => initialPlans
      .sort((a, b) => a.order_index - b.order_index)
      .map((p) => toDraft(p))
  )

  const usedOrders = useMemo(() => new Set(drafts.map(d => d.order_index)), [drafts])
  const canAdd = drafts.length < 6

  const displayMonth = useMemo(() => {
    const d = new Date(month)
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
  }, [month])

  function nextOrderIndex(): number {
    for (let i = 1; i <= 6; i++) if (!usedOrders.has(i)) return i
    return drafts.length + 1
  }

  function updateDraft(idx: number, patch: Partial<Draft>) {
    setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, ...patch, dirty: true } : d))
  }

  function addDraft() {
    if (!canAdd) return
    setDrafts(prev => [...prev, toDraft(undefined, nextOrderIndex())])
  }

  async function handleSave(idx: number) {
    const d = drafts[idx]
    if (!d.title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    if (d.order_index < 1 || d.order_index > 6) {
      setError('계획 순서는 1~6 사이여야 합니다.')
      return
    }

    const scheduled = d.scheduled_dates
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean)

    setError('')
    setSuccessMsg('')
    startTransition(async () => {
      const res = await upsertMonthlyPlan({
        id: d.id,
        participant_id: participantId,
        month,
        order_index: d.order_index,
        title: d.title,
        description: d.description || null,
        funding_source_id: d.funding_source_id || null,
        support_goal_id: d.support_goal_id || null,
        planned_budget: Number(d.planned_budget) || 0,
        target_count: d.target_count ? Number(d.target_count) : null,
        scheduled_dates: scheduled.length ? scheduled : null,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setSuccessMsg(`${d.order_index}번 계획이 저장되었어요.`)
      router.refresh()
      setDrafts(prev => prev.map((x, i) => i === idx ? { ...x, dirty: false } : x))
    })
  }

  async function handleDelete(idx: number) {
    const d = drafts[idx]
    if (!confirm(`${d.order_index}번 계획을 삭제할까요?`)) return

    if (!d.id) {
      setDrafts(prev => prev.filter((_, i) => i !== idx))
      return
    }

    setError('')
    setSuccessMsg('')
    startTransition(async () => {
      const res = await deleteMonthlyPlan(d.id!, participantId, month)
      if (res.error) {
        setError(res.error)
        return
      }
      setDrafts(prev => prev.filter((_, i) => i !== idx))
      setSuccessMsg(`${d.order_index}번 계획이 삭제되었어요.`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          <strong className="text-zinc-900">{displayMonth}</strong> 에 실행할 계획을 정리해주세요.
          각 계획의 제목, 예산, 예정일을 적으면 거래장부에서 연결할 수 있어요.
        </p>
        <button
          type="button"
          onClick={addDraft}
          disabled={!canAdd}
          className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
        >
          + 계획 추가 ({drafts.length}/6)
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
          {successMsg}
        </div>
      )}

      {drafts.length === 0 && (
        <div className="p-10 rounded-2xl bg-white ring-1 ring-zinc-200 text-center">
          <p className="text-zinc-500 font-medium">아직 계획이 없어요.</p>
          <p className="text-zinc-400 text-sm mt-1">“+ 계획 추가” 버튼을 눌러 새 계획을 만들어 보세요.</p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {drafts.map((d, idx) => (
          <section
            key={`${d.id ?? 'new'}-${idx}`}
            className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-zinc-900 text-white font-black flex items-center justify-center">
                  {d.order_index}
                </span>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">계획 순서</p>
                  <select
                    value={d.order_index}
                    onChange={(e) => updateDraft(idx, { order_index: Number(e.target.value) })}
                    className="text-sm font-bold text-zinc-800 bg-transparent focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n}번</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  disabled={isPending}
                  className="px-3 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(idx)}
                  disabled={isPending || !d.dirty}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
                >
                  {d.dirty ? '저장' : '저장됨'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <fieldset className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">계획 제목</label>
                <input
                  type="text"
                  value={d.title}
                  onChange={(e) => updateDraft(idx, { title: e.target.value })}
                  placeholder="예) 카페 4회 가기"
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                />
              </fieldset>

              <fieldset className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">상세 설명</label>
                <textarea
                  value={d.description}
                  onChange={(e) => updateDraft(idx, { description: e.target.value })}
                  rows={2}
                  placeholder="어떤 활동인지 구체적으로 적어주세요."
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-2 focus:ring-zinc-900 focus:outline-none resize-none"
                />
              </fieldset>

              <fieldset className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">재원 (돈주머니)</label>
                <select
                  value={d.funding_source_id}
                  onChange={(e) => updateDraft(idx, { funding_source_id: e.target.value })}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                >
                  <option value="">선택 안 함</option>
                  {fundingSources.map(fs => (
                    <option key={fs.id} value={fs.id}>{fs.name}</option>
                  ))}
                </select>
              </fieldset>

              {supportGoals.length > 0 && (
                <fieldset className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">연간 지원 목표 연결</label>
                  <select
                    value={d.support_goal_id}
                    onChange={(e) => updateDraft(idx, { support_goal_id: e.target.value })}
                    className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  >
                    <option value="">연결 안 함</option>
                    {supportGoals.map(g => (
                      <option key={g.id} value={g.id}>{g.order_index}. {g.support_area}</option>
                    ))}
                  </select>
                </fieldset>
              )}

              <fieldset className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">계획 예산 (원)</label>
                <input
                  type="number"
                  value={d.planned_budget}
                  onChange={(e) => updateDraft(idx, { planned_budget: e.target.value })}
                  placeholder="0"
                  min={0}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold text-right focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                />
              </fieldset>

              <fieldset className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">목표 횟수 (선택)</label>
                <input
                  type="number"
                  value={d.target_count}
                  onChange={(e) => updateDraft(idx, { target_count: e.target.value })}
                  placeholder="예) 4"
                  min={0}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold text-right focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                />
              </fieldset>

              <fieldset className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">예정일 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={d.scheduled_dates}
                  onChange={(e) => updateDraft(idx, { scheduled_dates: e.target.value })}
                  placeholder="예) 2026-04-05, 2026-04-12"
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                />
              </fieldset>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
