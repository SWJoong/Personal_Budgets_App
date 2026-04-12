'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'
import { updateTransactionDetail, deleteTransactionWithBalance } from '@/app/actions/transaction'

interface Tx {
  id: string
  activity_name: string
  amount: number
  date: string
  category: string | null
  memo: string | null
  payment_method: string | null
  status: 'pending' | 'confirmed'
  receipt_image_url: string | null
  funding_source_id: string | null
  participant: { name: string } | null
  funding_source: { name: string } | null
}

export default function TransactionDetailClient({ tx }: { tx: Tx }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [activityName, setActivityName] = useState(tx.activity_name)
  const [amount, setAmount] = useState(String(Math.abs(tx.amount)))
  const [category, setCategory] = useState(tx.category || '')
  const [memo, setMemo] = useState(tx.memo || '')
  const [date, setDate] = useState(tx.date)
  const [paymentMethod, setPaymentMethod] = useState(tx.payment_method || '')
  const [status, setStatus] = useState<'pending' | 'confirmed'>(tx.status)

  const categories = ['식비', '교통비', '여가활동', '생활용품', '의료비', '교육', '기타']

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateTransactionDetail(
        tx.id,
        {
          activity_name: activityName,
          amount: Number(amount),
          date,
          category: category || null,
          memo: memo || null,
          payment_method: paymentMethod || null,
          status,
        },
        tx.status,
        Math.abs(tx.amount),
        tx.funding_source_id
      )
      router.push('/supporter/transactions')
      router.refresh()
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteTransactionWithBalance(tx.id)
      router.push('/supporter/transactions')
      router.refresh()
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 text-2xl font-bold transition-colors">←</Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">거래 내역 수정 및 승인</h1>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        >내역 삭제</button>
      </header>

      <main className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-start">
        {/* 좌측: 증빙 뷰어 */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-zinc-800">증빙 자료 (영수증)</h2>
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-4 flex flex-col items-center justify-center min-h-[500px]">
            {tx.receipt_image_url ? (
              <img src={tx.receipt_image_url} alt="영수증 이미지" className="max-w-full max-h-[700px] object-contain rounded-lg" />
            ) : (
              <div className="text-zinc-400 flex flex-col items-center gap-3">
                <span className="text-5xl">📄</span>
                <p className="font-medium">첨부된 영수증이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* 우측: 폼 및 승인 */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-zinc-800">거래 상세 정보 입력</h2>
          <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm p-6">
            <div className="mb-6 flex justify-between items-center bg-zinc-50 p-4 rounded-lg">
              <div>
                <p className="text-xs text-zinc-500 font-bold mb-1">당사자</p>
                <p className="font-black text-zinc-900 text-lg">{tx.participant?.name || '알 수 없음'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500 font-bold mb-1">재원</p>
                <p className="font-black text-zinc-900 text-lg">{tx.funding_source?.name || '미지정'}</p>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="flex flex-col gap-5">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <fieldset className="flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">날짜</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-medium focus:ring-zinc-400 focus:outline-none" required />
                </fieldset>
                <fieldset className="flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-500">금액 (원)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    className="p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-bold focus:ring-zinc-400 focus:outline-none" required min="0" />
                </fieldset>
              </div>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">활동 내용</label>
                <input type="text" value={activityName} onChange={e => setActivityName(e.target.value)}
                  className="p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-medium focus:ring-zinc-400 focus:outline-none" required />
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">분류</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button key={cat} type="button" onClick={() => setCategory(category === cat ? '' : cat)}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
                        category === cat ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}>{cat}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">결제 수단</label>
                <div className="flex gap-2">
                  {['체크카드', '현금', '계좌이체'].map(method => (
                    <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors flex-1 ${
                        paymentMethod === method ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}>{method}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">메모</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
                  className="p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-medium focus:ring-zinc-400 focus:outline-none resize-none" />
              </fieldset>

              <div className="h-px bg-zinc-200 my-2" />

              <fieldset className="flex flex-col gap-2">
                <label className="text-xs font-black text-zinc-500">반영 상태 (승인)</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStatus('confirmed')}
                    className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                      status === 'confirmed' ? 'bg-green-50 ring-green-300 text-green-700' : 'bg-zinc-50 ring-zinc-200 text-zinc-500 hover:bg-zinc-100'
                    }`}>
                    <span className="text-lg block mb-1">✅</span>확정 처리
                  </button>
                  <button type="button" onClick={() => setStatus('pending')}
                    className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                      status === 'pending' ? 'bg-orange-50 ring-orange-300 text-orange-700' : 'bg-zinc-50 ring-zinc-200 text-zinc-500 hover:bg-zinc-100'
                    }`}>
                    <span className="text-lg block mb-1">⏳</span>임시 대기
                  </button>
                </div>
              </fieldset>

              <button type="submit" disabled={saving}
                className="mt-4 p-4 rounded-xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />저장하고 있습니다...</>
                  : '수정 사항 저장하기'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900 mb-2">정말 삭제하시겠습니까?</h3>
            <p className="text-sm text-zinc-500 mb-1">
              <strong>{activityName}</strong> — {formatCurrency(Number(amount))}원
            </p>
            {status === 'confirmed' && (
              <p className="text-sm text-orange-600 font-medium mb-4">
                ⚠️ 확정된 내역입니다. 삭제 시 잔액이 복원됩니다.
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 p-3 rounded-xl bg-zinc-100 text-zinc-600 font-bold hover:bg-zinc-200 transition-colors">
                취소
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 p-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />삭제 중...</>
                  : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
