'use client'

import { useState, useTransition } from 'react'
import {
  upsertBudgetLineItem,
  deleteBudgetLineItem,
  type BudgetLineItem,
  type BudgetLineItemInput,
} from '@/app/actions/budgetLineItem'
import type { SupportGoal } from '@/app/actions/supportGoal'

interface Props {
  carePlanId: string
  participantId: string
  initialItems: BudgetLineItem[]
  supportGoals: SupportGoal[]
  fundingSources: { id: string; name: string }[]
}

interface Draft {
  id?: string
  funding_source_id: string
  support_goal_id: string
  category: string
  item_name: string
  unit_cost: string
  quantity: string
  unit_label: string
  calculation_note: string
  order_index: number
  dirty: boolean
  isNew: boolean
}

function toDraft(item?: BudgetLineItem, order_index = 1): Draft {
  return {
    id: item?.id,
    funding_source_id: item?.funding_source_id ?? '',
    support_goal_id: item?.support_goal_id ?? '',
    category: item?.category ?? '',
    item_name: item?.item_name ?? '',
    unit_cost: item ? String(item.unit_cost) : '',
    quantity: item ? String(item.quantity) : '1',
    unit_label: item?.unit_label ?? '',
    calculation_note: item?.calculation_note ?? '',
    order_index: item?.order_index ?? order_index,
    dirty: false,
    isNew: !item,
  }
}

function calcTotal(unit_cost: string, quantity: string): number {
  const c = parseFloat(unit_cost) || 0
  const q = parseFloat(quantity) || 0
  return c * q
}

export default function BudgetLineItemsTable({
  carePlanId,
  participantId,
  initialItems,
  supportGoals,
  fundingSources,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    [...initialItems].sort((a, b) => a.order_index - b.order_index).map(i => toDraft(i))
  )
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function update(idx: number, patch: Partial<Draft>) {
    setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, ...patch, dirty: true } : d))
  }

  function addRow() {
    setDrafts(prev => [...prev, toDraft(undefined, prev.length + 1)])
  }

  async function handleSave(idx: number) {
    const d = drafts[idx]
    if (!d.category.trim()) { showToast(false, '항목 분류를 입력해주세요.'); return }
    if (!d.item_name.trim()) { showToast(false, '항목 이름을 입력해주세요.'); return }
    if (!d.unit_cost || parseFloat(d.unit_cost) < 0) { showToast(false, '단가를 입력해주세요.'); return }
    if (!d.quantity || parseFloat(d.quantity) <= 0) { showToast(false, '수량을 입력해주세요.'); return }

    const input: BudgetLineItemInput = {
      id: d.id,
      care_plan_id: carePlanId,
      funding_source_id: d.funding_source_id || null,
      support_goal_id: d.support_goal_id || null,
      category: d.category,
      item_name: d.item_name,
      unit_cost: parseFloat(d.unit_cost),
      quantity: parseFloat(d.quantity),
      unit_label: d.unit_label || null,
      calculation_note: d.calculation_note || null,
      order_index: d.order_index,
    }
    startTransition(async () => {
      const result = await upsertBudgetLineItem(input, participantId)
      if (result.error) {
        showToast(false, result.error)
      } else {
        update(idx, { dirty: false, isNew: false })
        showToast(true, '저장되었습니다.')
      }
    })
  }

  async function confirmDelete(id: string) {
    startTransition(async () => {
      const result = await deleteBudgetLineItem(id, participantId)
      if (result.error) {
        showToast(false, result.error)
      } else {
        setDrafts(prev => prev.filter(d => d.id !== id))
        showToast(true, '삭제되었습니다.')
      }
      setDeletingId(null)
    })
  }

  // 재원별 합계
  const summary = drafts.reduce<Record<string, { name: string; total: number }>>(
    (acc, d) => {
      const key = d.funding_source_id || '__none__'
      const name = fundingSources.find(f => f.id === d.funding_source_id)?.name ?? '미분류'
      const total = calcTotal(d.unit_cost, d.quantity)
      acc[key] = { name, total: (acc[key]?.total ?? 0) + total }
      return acc
    },
    {}
  )
  const grandTotal = Object.values(summary).reduce((s, v) => s + v.total, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
            <p className="text-lg font-bold text-zinc-900 mb-2">정말 삭제하시겠어요?</p>
            <p className="text-sm text-zinc-500 mb-6">삭제된 항목은 되돌릴 수 없어요.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeletingId(null)} className="px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors min-w-[80px]">취소</button>
              <button onClick={() => confirmDelete(deletingId)} disabled={isPending} className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors min-w-[80px] disabled:opacity-50">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 재원별 합계 요약 */}
      {drafts.length > 0 && (
        <div className="bg-zinc-50 rounded-2xl p-4 ring-1 ring-zinc-200 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-black text-zinc-400 uppercase tracking-widest mr-2">재원별 합계</span>
          {Object.values(summary).map(s => (
            <span key={s.name} className="px-3 py-1 rounded-full bg-white ring-1 ring-zinc-200 text-xs font-bold text-zinc-700">
              {s.name}: {s.total.toLocaleString()}원
            </span>
          ))}
          <span className="ml-auto text-sm font-black text-zinc-900">총계 {grandTotal.toLocaleString()}원</span>
        </div>
      )}

      {/* 세목 목록 */}
      {drafts.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 ring-1 ring-zinc-200 text-center text-zinc-400 text-sm">
          등록된 예산 세목이 없어요. 아래에서 추가해 주세요.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((d, idx) => (
            <div key={d.id ?? `new-${idx}`} className={`bg-white rounded-2xl ring-1 ${d.dirty ? 'ring-amber-300' : 'ring-zinc-200'} shadow-sm p-4`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 분류 */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">항목 분류 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={d.category}
                    onChange={e => update(idx, { category: e.target.value })}
                    placeholder="예: 교통비, 식비"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                {/* 항목명 */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">항목 이름 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={d.item_name}
                    onChange={e => update(idx, { item_name: e.target.value })}
                    placeholder="예: 버스 정기권"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                {/* 재원 */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">재원</label>
                  <select
                    value={d.funding_source_id}
                    onChange={e => update(idx, { funding_source_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                  >
                    <option value="">미분류</option>
                    {fundingSources.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                {/* 관련 목표 */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">관련 지원 목표</label>
                  <select
                    value={d.support_goal_id}
                    onChange={e => update(idx, { support_goal_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                  >
                    <option value="">없음</option>
                    {supportGoals.filter(g => g.is_active).map(g => (
                      <option key={g.id} value={g.id}>{g.order_index}. {g.support_area}</option>
                    ))}
                  </select>
                </div>
                {/* 인라인 계산기 */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">단가 <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={d.unit_cost}
                      onChange={e => update(idx, { unit_cost: e.target.value })}
                      placeholder="0"
                      min="0"
                      className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <span className="text-zinc-400 text-xs font-bold">곱하기</span>
                    <input
                      type="number"
                      value={d.quantity}
                      onChange={e => update(idx, { quantity: e.target.value })}
                      placeholder="1"
                      min="0.01"
                      step="0.01"
                      className="w-20 px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                </div>
                {/* 합계 (자동 계산, 읽기 전용) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">합계 (자동)</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-100 text-sm font-bold text-zinc-900">
                      {calcTotal(d.unit_cost, d.quantity).toLocaleString()}원
                    </div>
                    <input
                      type="text"
                      value={d.unit_label}
                      onChange={e => update(idx, { unit_label: e.target.value })}
                      placeholder="단위"
                      className="w-16 px-2 py-2 rounded-xl border border-zinc-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                </div>
                {/* 산출 근거 */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-zinc-500 mb-1">산출 근거</label>
                  <input
                    type="text"
                    value={d.calculation_note}
                    onChange={e => update(idx, { calculation_note: e.target.value })}
                    placeholder="예: 월 4회 × 12개월"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* 행 버튼 */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-100">
                <button
                  onClick={() => d.id ? setDeletingId(d.id) : setDrafts(prev => prev.filter((_, i) => i !== idx))}
                  className="text-sm text-red-500 hover:text-red-700 font-bold transition-colors"
                >
                  삭제
                </button>
                <div className="flex items-center gap-2">
                  {d.dirty && <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">미저장</span>}
                  <button
                    onClick={() => handleSave(idx)}
                    disabled={isPending || !d.dirty}
                    className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors disabled:opacity-40"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가 버튼 */}
      <button
        onClick={addRow}
        disabled={isPending}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-400 text-sm font-bold hover:border-zinc-500 hover:text-zinc-600 transition-colors disabled:opacity-40"
      >
        + 세목 추가
      </button>
    </div>
  )
}
