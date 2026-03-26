'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createTransaction } from '@/app/actions/transaction'

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
  const [isExpense, setIsExpense] = useState(true) // 지출/수입 토글

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
        .select('id, name, funding_sources ( id, name )')

      if (profile?.role === 'supporter') {
        query = query.eq('assigned_supporter_id', user.id)
      }

      const { data } = await query

      const mapped = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name || p.id.slice(0, 8),
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
    if (!selectedParticipant || !activityName || !amount || !selectedFundingSource) {
      setError('필수 항목(당사자, 재원, 활동, 금액)을 모두 입력하세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('participant_id', selectedParticipant)
      formData.append('funding_source_id', selectedFundingSource)
      formData.append('amount', amount)
      formData.append('date', date)
      formData.append('description', activityName)
      formData.append('category', category)
      formData.append('memo', memo)
      formData.append('status', status)
      formData.append('is_expense', String(isExpense))
      formData.append('payment_method', paymentMethod)

      const result = await createTransaction(formData)
      if (result.success) {
        router.push('/supporter/transactions')
        router.refresh()
      }
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.')
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
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200 z-20">
        <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 mr-3 transition-colors text-xl font-bold">←</Link>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">내역 직접 등록 (수동 장부)</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          {/* 지출 / 수입 선택 토글 */}
          <div className="flex bg-zinc-200 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setIsExpense(true)}
              className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
                isExpense ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >💸 지출 (나가는 돈)</button>
            <button
              type="button"
              onClick={() => setIsExpense(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
                !isExpense ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >💰 수입 (들어오는 돈)</button>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm ring-1 ring-zinc-200 flex flex-col gap-6">
            {/* 당사자 및 재원 선택 */}
            <div className="grid grid-cols-1 gap-5">
              <fieldset className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">당사자</label>
                <select
                  value={selectedParticipant}
                  onChange={(e) => {
                    setSelectedParticipant(e.target.value)
                    setSelectedFundingSource('')
                  }}
                  className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none transition-all appearance-none"
                  required
                >
                  <option value="">대상자를 선택하세요</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </fieldset>

              <fieldset className={`flex flex-col gap-2 transition-all ${!selectedParticipant ? 'opacity-30 pointer-events-none' : ''}`}>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">결제 재원 (돈주머니)</label>
                <select
                  value={selectedFundingSource}
                  onChange={(e) => setSelectedFundingSource(e.target.value)}
                  className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none transition-all appearance-none"
                  disabled={!selectedParticipant}
                  required
                >
                  <option value="">재원을 선택하세요</option>
                  {currentParticipant?.funding_sources.map(fs => (
                    <option key={fs.id} value={fs.id}>{fs.name}</option>
                  ))}
                </select>
              </fieldset>
            </div>

            <hr className="border-zinc-100" />

            {/* 날짜 및 금액 */}
            <div className="grid grid-cols-1 gap-5">
              <fieldset className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">거래 날짜</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  required
                />
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{isExpense ? '지출 금액' : '수입 금액'}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className={`w-full p-5 rounded-2xl ring-1 font-black text-3xl text-right focus:ring-2 focus:outline-none transition-all ${
                      isExpense ? 'bg-red-50/30 ring-red-100 focus:ring-red-500 text-red-600' : 'bg-blue-50/30 ring-blue-100 focus:ring-blue-500 text-blue-600'
                    }`}
                    required
                    min="0"
                  />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-zinc-300 text-xl">₩</span>
                </div>
              </fieldset>
            </div>

            {/* 활동 내용 */}
            <fieldset className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">활동 내용 (품명)</label>
              <input
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="어디에 사용했나요?"
                className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-bold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                required
              />
            </fieldset>

            {/* 분류 */}
            <fieldset className="flex flex-col gap-3">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">분류 카테고리</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(category === cat ? '' : cat)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                      category === cat
                        ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                        : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'
                    }`}
                  >{cat}</button>
                ))}
              </div>
            </fieldset>

            {/* 결제 수단 */}
            <fieldset className="flex flex-col gap-3">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">결제 방법</label>
              <div className="flex gap-2">
                {['체크카드', '현금', '계좌이체'].map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${
                      paymentMethod === method
                        ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                        : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'
                    }`}
                  >{method}</button>
                ))}
              </div>
            </fieldset>

            {/* 메모 */}
            <fieldset className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">특이사항 메모</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="기억해야 할 내용이 있다면 적어주세요"
                rows={3}
                className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-2 focus:ring-zinc-900 focus:outline-none resize-none"
              />
            </fieldset>

            {/* 상태 선택 */}
            <fieldset className="flex flex-col gap-3">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">장부 반영 상태</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('confirmed')}
                  className={`flex-1 p-4 rounded-2xl text-sm font-black transition-all ring-2 ${
                    status === 'confirmed'
                      ? 'bg-green-50 ring-green-500 text-green-700 shadow-md'
                      : 'bg-white ring-zinc-100 text-zinc-400 hover:ring-zinc-200'
                  }`}
                >
                  <span className="text-xl block mb-1">✅</span>
                  즉시 확정
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('pending')}
                  className={`flex-1 p-4 rounded-2xl text-sm font-black transition-all ring-2 ${
                    status === 'pending'
                      ? 'bg-orange-50 ring-orange-400 text-orange-700 shadow-md'
                      : 'bg-white ring-zinc-100 text-zinc-400 hover:ring-zinc-200'
                  }`}
                >
                  <span className="text-xl block mb-1">⏳</span>
                  임시 대기
                </button>
              </div>
            </fieldset>
          </div>

          {/* 최종 등록 버튼 */}
          <button
            type="submit"
            disabled={saving || !selectedParticipant || !activityName || !amount || !selectedFundingSource}
            className={`p-6 rounded-[2rem] text-white font-black text-xl transition-all active:scale-95 disabled:bg-zinc-300 shadow-2xl mt-4 ${
              isExpense ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? '장부 기록 중...' : isExpense ? '지출 내역 등록하기' : '수입 내역 등록하기'}
          </button>
        </form>
      </main>
    </div>
  )
}
