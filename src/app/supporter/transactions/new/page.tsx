'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ParticipantOption {
  id: string
  name: string
  funding_sources: { id: string; name: string }[]
}

export default function NewTransactionPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [participants, setParticipants] = useState<ParticipantOption[]>([])
  const [selectedParticipant, setSelectedParticipant] = useState('')
  const [selectedFundingSource, setSelectedFundingSource] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [activityName, setActivityName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [memo, setMemo] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('체크카드')
  const [status, setStatus] = useState<'pending' | 'confirmed'>('confirmed')

  const categories = ['식비', '교통비', '여가활동', '생활용품', '의료비', '교육', '기타']

  useEffect(() => {
    loadParticipants()
  }, [])

  async function loadParticipants() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      let query = supabase
        .from('participants')
        .select('id, profiles!participants_id_fkey ( name ), funding_sources ( id, name )')

      if (profile?.role === 'supporter') {
        query = query.eq('assigned_supporter_id', user.id)
      }

      const { data } = await query

      const mapped = (data || []).map((p: any) => ({
        id: p.id,
        name: p.profiles?.name || p.id.slice(0, 8),
        funding_sources: p.funding_sources || []
      }))

      setParticipants(mapped)

      if (mapped.length === 1) {
        setSelectedParticipant(mapped[0].id)
        if (mapped[0].funding_sources.length === 1) {
          setSelectedFundingSource(mapped[0].funding_sources[0].id)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const currentParticipant = participants.find(p => p.id === selectedParticipant)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedParticipant || !activityName || !amount) {
      setError('필수 항목을 입력하세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          participant_id: selectedParticipant,
          funding_source_id: selectedFundingSource || null,
          date,
          activity_name: activityName,
          amount: Number(amount),
          category: category || null,
          memo: memo || null,
          payment_method: paymentMethod || null,
          status,
          creator_id: user?.id,
        })

      if (txError) throw txError

      // 확정 상태인 경우 잔액 차감
      if (status === 'confirmed' && selectedFundingSource) {
        const { data: fs } = await supabase
          .from('funding_sources')
          .select('current_month_balance, current_year_balance')
          .eq('id', selectedFundingSource)
          .single()

        if (fs) {
          await supabase
            .from('funding_sources')
            .update({
              current_month_balance: Number(fs.current_month_balance) - Number(amount),
              current_year_balance: Number(fs.current_year_balance) - Number(amount),
            })
            .eq('id', selectedFundingSource)
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

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 mr-3">←</Link>
          <h1 className="text-xl font-bold tracking-tight">사용 내역 등록</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">불러오는 중...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 mr-3">←</Link>
        <h1 className="text-xl font-bold tracking-tight">사용 내역 등록</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          {/* 당사자 선택 */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">당사자</label>
            <select
              value={selectedParticipant}
              onChange={(e) => {
                setSelectedParticipant(e.target.value)
                setSelectedFundingSource('')
              }}
              className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
              required
            >
              <option value="">선택해주세요</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </fieldset>

          {/* 재원 선택 */}
          {currentParticipant && currentParticipant.funding_sources.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">재원</label>
              <select
                value={selectedFundingSource}
                onChange={(e) => setSelectedFundingSource(e.target.value)}
                className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
              >
                <option value="">선택해주세요</option>
                {currentParticipant.funding_sources.map(fs => (
                  <option key={fs.id} value={fs.id}>{fs.name}</option>
                ))}
              </select>
            </fieldset>
          )}

          {/* 날짜 + 금액 */}
          <div className="grid grid-cols-2 gap-4">
            <fieldset className="flex flex-col gap-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">날짜</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
                required
              />
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">금액 (원)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-zinc-400 focus:outline-none"
                required
                min="0"
              />
            </fieldset>
          </div>

          {/* 활동명 */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">활동 내용</label>
            <input
              type="text"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="예: 카페 방문, 마트 장보기"
              className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
              required
            />
          </fieldset>

          {/* 분류 */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">분류</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? '' : cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    category === cat
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >{cat}</button>
              ))}
            </div>
          </fieldset>

          {/* 결제 수단 */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">결제 수단</label>
            <div className="flex gap-2">
              {['체크카드', '현금', '계좌이체'].map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-1 ${
                    paymentMethod === method
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >{method}</button>
              ))}
            </div>
          </fieldset>

          {/* 메모 */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">메모 (선택)</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="추가 메모를 입력하세요"
              rows={2}
              className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none resize-none"
            />
          </fieldset>

          {/* 상태 선택 */}
          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">반영 상태</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStatus('confirmed')}
                className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                  status === 'confirmed'
                    ? 'bg-green-50 ring-green-300 text-green-700'
                    : 'bg-white ring-zinc-200 text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <span className="text-lg block mb-1">✅</span>
                확정 반영
              </button>
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={`flex-1 p-4 rounded-xl text-sm font-bold transition-all ring-1 ${
                  status === 'pending'
                    ? 'bg-orange-50 ring-orange-300 text-orange-700'
                    : 'bg-white ring-zinc-200 text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <span className="text-lg block mb-1">⏳</span>
                임시 반영
              </button>
            </div>
          </fieldset>

          {/* 제출 */}
          <button
            type="submit"
            disabled={saving || !selectedParticipant || !activityName || !amount}
            className="p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg"
          >
            {saving ? '저장하고 있습니다...' : '사용 내역 등록하기'}
          </button>
        </form>
      </main>
    </div>
  )
}
