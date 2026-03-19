'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function TransactionDetailPage({ params }: PageProps) {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [txId, setTxId] = useState('')

  const [tx, setTx] = useState<any>(null)
  const [activityName, setActivityName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [memo, setMemo] = useState('')
  const [date, setDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [status, setStatus] = useState<'pending' | 'confirmed'>('pending')

  const categories = ['식비', '교통비', '여가활동', '생활용품', '의료비', '교육', '기타']

  useEffect(() => {
    params.then(({ id }) => {
      setTxId(id)
      loadTransaction(id)
    })
  }, [])

  async function loadTransaction(id: string) {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*, participant:participants!transactions_participant_id_fkey ( profiles!participants_id_fkey ( name ) ), funding_source:funding_sources!transactions_funding_source_id_fkey ( name )')
        .eq('id', id)
        .single()

      if (data) {
        setTx(data)
        setActivityName(data.activity_name)
        setAmount(String(data.amount))
        setCategory(data.category || '')
        setMemo(data.memo || '')
        setDate(data.date)
        setPaymentMethod(data.payment_method || '')
        setStatus(data.status)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const oldStatus = tx.status
      const oldAmount = Number(tx.amount)
      const newAmount = Number(amount)

      // 트랜잭션 업데이트
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          activity_name: activityName,
          amount: newAmount,
          category: category || null,
          memo: memo || null,
          date,
          payment_method: paymentMethod || null,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', txId)

      if (updateError) throw updateError

      // 잔액 조정 로직
      if (tx.funding_source_id) {
        const { data: fs } = await supabase
          .from('funding_sources')
          .select('current_month_balance, current_year_balance')
          .eq('id', tx.funding_source_id)
          .single()

        if (fs) {
          let monthAdj = 0
          let yearAdj = 0

          // 기존: confirmed → 새: confirmed (금액 차이 반영)
          if (oldStatus === 'confirmed' && status === 'confirmed') {
            monthAdj = oldAmount - newAmount
            yearAdj = oldAmount - newAmount
          }
          // 기존: pending → 새: confirmed (신규 차감)
          else if (oldStatus === 'pending' && status === 'confirmed') {
            monthAdj = -newAmount
            yearAdj = -newAmount
          }
          // 기존: confirmed → 새: pending (복원)
          else if (oldStatus === 'confirmed' && status === 'pending') {
            monthAdj = oldAmount
            yearAdj = oldAmount
          }

          if (monthAdj !== 0 || yearAdj !== 0) {
            await supabase
              .from('funding_sources')
              .update({
                current_month_balance: Number(fs.current_month_balance) + monthAdj,
                current_year_balance: Number(fs.current_year_balance) + yearAdj,
              })
              .eq('id', tx.funding_source_id)
          }
        }
      }

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
      // 확정 상태였다면 잔액 복원
      if (tx.status === 'confirmed' && tx.funding_source_id) {
        const { data: fs } = await supabase
          .from('funding_sources')
          .select('current_month_balance, current_year_balance')
          .eq('id', tx.funding_source_id)
          .single()

        if (fs) {
          await supabase
            .from('funding_sources')
            .update({
              current_month_balance: Number(fs.current_month_balance) + Number(tx.amount),
              current_year_balance: Number(fs.current_year_balance) + Number(tx.amount),
            })
            .eq('id', tx.funding_source_id)
        }
      }

      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId)

      if (deleteError) throw deleteError

      router.push('/supporter/transactions')
      router.refresh()
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 mr-3">←</Link>
          <h1 className="text-xl font-bold tracking-tight">내역 상세</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">불러오는 중...</p>
        </main>
      </div>
    )
  }

  if (!tx) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 mr-3">←</Link>
          <h1 className="text-xl font-bold tracking-tight">내역 상세</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">내역을 찾을 수 없습니다.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600">←</Link>
          <h1 className="text-xl font-bold tracking-tight">내역 수정</h1>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-3 py-1.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >삭제</button>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {/* 기본 정보 표시 */}
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 mb-5 flex justify-between items-center">
          <div>
            <p className="text-xs text-zinc-400 font-medium">당사자</p>
            <p className="font-bold text-zinc-800">{tx.participant?.profiles?.name || '알 수 없음'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-400 font-medium">재원</p>
            <p className="font-bold text-zinc-800">{tx.funding_source?.name || '미지정'}</p>
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
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">날짜</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none" required />
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">금액 (원)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-zinc-400 focus:outline-none" required min="0" />
            </fieldset>
          </div>

          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">활동 내용</label>
            <input type="text" value={activityName} onChange={(e) => setActivityName(e.target.value)}
              className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none" required />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">분류</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(category === cat ? '' : cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    category === cat ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}>{cat}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">결제 수단</label>
            <div className="flex gap-2">
              {['체크카드', '현금', '계좌이체'].map(method => (
                <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-1 ${
                    paymentMethod === method ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}>{method}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">메모</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2}
              className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none resize-none" />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">반영 상태</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStatus('confirmed')}
                className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                  status === 'confirmed' ? 'bg-green-50 ring-green-300 text-green-700' : 'bg-white ring-zinc-200 text-zinc-500'
                }`}>
                <span className="text-lg block mb-1">✅</span>확정 반영
              </button>
              <button type="button" onClick={() => setStatus('pending')}
                className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                  status === 'pending' ? 'bg-orange-50 ring-orange-300 text-orange-700' : 'bg-white ring-zinc-200 text-zinc-500'
                }`}>
                <span className="text-lg block mb-1">⏳</span>임시 반영
              </button>
            </div>
          </fieldset>

          <button type="submit" disabled={saving}
            className="p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors active:scale-[0.98] disabled:opacity-50 shadow-lg">
            {saving ? '저장하고 있습니다...' : '수정 저장하기'}
          </button>
        </form>
      </main>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
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
                className="flex-1 p-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50">
                {deleting ? '삭제 중...' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
