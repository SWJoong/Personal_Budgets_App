'use client'

import { useState, useTransition } from 'react'
import { updateTransactionStatus, updateTransaction, deleteTransaction } from '@/app/actions/transaction'

interface FundingSource {
  id: string
  name: string
}

interface ReviewTransaction {
  id: string
  participant_id: string
  participant_name: string
  activity_name: string
  amount: number
  date: string
  category: string
  payment_method: string
  receipt_image_url: string | null
  funding_source_id: string | null
  funding_source_name: string | null
}

interface Props {
  transactions: ReviewTransaction[]
  allFundingSources: Record<string, FundingSource[]>  // participant_id → sources
}

export default function ReviewQueueClient({ transactions, allFundingSources }: Props) {
  const [items, setItems] = useState(transactions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<ReviewTransaction>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  function setBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev)
      busy ? next.add(id) : next.delete(id)
      return next
    })
  }

  function startEdit(tx: ReviewTransaction) {
    setEditingId(tx.id)
    setEditValues({
      activity_name: tx.activity_name,
      amount: Math.abs(tx.amount),
      date: tx.date,
      category: tx.category,
      funding_source_id: tx.funding_source_id ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
  }

  async function saveEdit(txId: string) {
    setBusy(txId, true)
    try {
      const amount = Number(editValues.amount) || 0
      await updateTransaction(txId, {
        activity_name: editValues.activity_name,
        amount,
        date: editValues.date,
        category: editValues.category,
        funding_source_id: editValues.funding_source_id || undefined,
      })
      setItems(prev => prev.map(t => t.id === txId
        ? { ...t, ...editValues, amount }
        : t
      ))
      setEditingId(null)
    } catch {
      alert('수정에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(txId, false)
    }
  }

  async function confirmOne(txId: string) {
    setBusy(txId, true)
    try {
      await updateTransactionStatus(txId, 'confirmed')
      setItems(prev => prev.filter(t => t.id !== txId))
    } catch {
      alert('확인에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(txId, false)
    }
  }

  async function deleteOne(txId: string) {
    if (!confirm('이 항목을 삭제할까요?')) return
    setBusy(txId, true)
    try {
      await deleteTransaction(txId)
      setItems(prev => prev.filter(t => t.id !== txId))
    } catch {
      alert('삭제에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(txId, false)
    }
  }

  function confirmAll() {
    if (!confirm(`${items.length}건을 모두 확인 처리할까요?`)) return
    startTransition(async () => {
      for (const tx of items) {
        try {
          await updateTransactionStatus(tx.id, 'confirmed')
        } catch {
          // 개별 실패는 무시하고 계속
        }
      }
      setItems([])
    })
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-2xl ring-1 ring-zinc-100">
        <span className="text-5xl">✅</span>
        <p className="text-base font-black text-zinc-700">대기 중인 영수증이 없어요</p>
        <p className="text-sm text-zinc-400">모든 거래가 확인 완료되었어요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 일괄 확인 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-500">
          {items.length}건 대기 중
        </p>
        <button
          onClick={confirmAll}
          disabled={isPending}
          className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-black hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {isPending ? '처리 중...' : `전체 확인 (${items.length}건)`}
        </button>
      </div>

      {/* 카드 목록 */}
      {items.map(tx => {
        const isBusy = busyIds.has(tx.id)
        const isEditing = editingId === tx.id
        const sources = allFundingSources[tx.participant_id] ?? []

        return (
          <div
            key={tx.id}
            className={`bg-white rounded-2xl ring-1 ring-zinc-200 overflow-hidden shadow-sm transition-opacity ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 bg-zinc-50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-black text-zinc-600">
                  {(tx.participant_name ?? '?')[0]}
                </div>
                <span className="font-black text-sm text-zinc-800">{tx.participant_name}</span>
              </div>
              <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">검토 대기</span>
            </div>

            {/* 카드 본문 */}
            {isEditing ? (
              <div className="p-5 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">활동명</label>
                    <input
                      type="text"
                      value={editValues.activity_name ?? ''}
                      onChange={e => setEditValues(v => ({ ...v, activity_name: e.target.value }))}
                      className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold outline-none focus:ring-zinc-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">금액 (원)</label>
                    <input
                      type="number"
                      step={100}
                      value={editValues.amount ?? ''}
                      onChange={e => setEditValues(v => ({ ...v, amount: Number(e.target.value) }))}
                      className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold outline-none focus:ring-zinc-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">날짜</label>
                    <input
                      type="date"
                      value={editValues.date ?? ''}
                      onChange={e => setEditValues(v => ({ ...v, date: e.target.value }))}
                      className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold outline-none focus:ring-zinc-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">카테고리</label>
                    <input
                      type="text"
                      value={editValues.category ?? ''}
                      onChange={e => setEditValues(v => ({ ...v, category: e.target.value }))}
                      className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold outline-none focus:ring-zinc-900"
                    />
                  </div>
                  {sources.length > 1 && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">재원</label>
                      <select
                        value={editValues.funding_source_id ?? ''}
                        onChange={e => setEditValues(v => ({ ...v, funding_source_id: e.target.value }))}
                        className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold outline-none focus:ring-zinc-900"
                      >
                        {sources.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 text-sm font-black hover:bg-zinc-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => saveEdit(tx.id)}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-black hover:bg-zinc-800 transition-colors"
                  >
                    수정 저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 px-5 py-4">
                {/* 영수증 썸네일 */}
                {tx.receipt_image_url ? (
                  <button
                    onClick={() => setPreviewUrl(tx.receipt_image_url)}
                    className="w-14 h-14 rounded-xl overflow-hidden ring-1 ring-zinc-200 shrink-0 hover:ring-zinc-900 transition-all"
                  >
                    <img
                      src={tx.receipt_image_url}
                      alt="영수증"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-zinc-50 ring-1 ring-zinc-100 shrink-0 flex items-center justify-center text-zinc-300 text-2xl">
                    🧾
                  </div>
                )}

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-zinc-900 text-sm truncate">{tx.activity_name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {tx.date} · {tx.category} · {tx.funding_source_name ?? '재원 미지정'}
                  </p>
                </div>

                {/* 금액 */}
                <div className="text-right shrink-0">
                  <p className="font-black text-zinc-900 text-base">
                    {Math.abs(tx.amount).toLocaleString()}원
                  </p>
                  <p className="text-[10px] text-zinc-400">{tx.payment_method}</p>
                </div>

                {/* 액션 */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => confirmOne(tx.id)}
                    className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-black hover:bg-green-600 active:scale-95 transition-all"
                  >
                    확인
                  </button>
                  <button
                    onClick={() => startEdit(tx)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-black hover:bg-zinc-200 active:scale-95 transition-all"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteOne(tx.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-black hover:bg-red-100 active:scale-95 transition-all"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* 영수증 이미지 전체보기 모달 */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-zinc-700 font-black text-sm flex items-center justify-center shadow-lg"
            >
              ✕
            </button>
            <img
              src={previewUrl}
              alt="영수증 원본"
              className="w-full rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
