'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTransaction } from '@/app/actions/transaction'

export default function TransactionForm({
  participantId,
  fundingSources,
}: {
  participantId: string
  fundingSources: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.append('participant_id', participantId)

    try {
      await createTransaction(formData)
      // Redirect back to the transaction list on success
      router.push(`/supporter/${participantId}/transactions`)
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  // 매핑용 카테고리 (지원자 실무 기준)
  const categories = [
    '식비', '간식/음료', '교통비', '여가활동', '물품구입', '의료/건강', '기타'
  ]

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm ring-1 ring-zinc-200 max-w-2xl mx-auto space-y-6">
      
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium ring-1 ring-red-100">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date */}
        <div className="space-y-2">
          <label htmlFor="date" className="text-sm font-bold text-zinc-500 ml-1">활동/결제 일자 *</label>
          <input 
            type="date" 
            id="date" 
            name="date" 
            required 
            defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all" 
          />
        </div>

        {/* Funding Source */}
        <div className="space-y-2">
          <label htmlFor="funding_source_id" className="text-sm font-bold text-zinc-500 ml-1">결제 수단 (재원) *</label>
          <select 
            id="funding_source_id" 
            name="funding_source_id" 
            required
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          >
            <option value="">선택해주세요</option>
            {fundingSources.map(fs => (
              <option key={fs.id} value={fs.id}>{fs.name}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <label htmlFor="amount" className="text-sm font-bold text-zinc-500 ml-1">결제 금액 *</label>
          <input 
            type="number" 
            id="amount" 
            name="amount" 
            min="0"
            required 
            placeholder="예: 15000"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all" 
          />
        </div>

        {/* Type (Expense/Income) */}
        <div className="space-y-2">
          <label htmlFor="is_expense" className="text-sm font-bold text-zinc-500 ml-1">구분 *</label>
          <select 
            id="is_expense" 
            name="is_expense" 
            required
            defaultValue="true"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          >
            <option value="true">지출 (잔액 차감)</option>
            <option value="false">수입 (잔액 증가)</option>
          </select>
        </div>

        {/* Description */}
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="description" className="text-sm font-bold text-zinc-500 ml-1">활동명 (품목명) *</label>
          <input 
            type="text" 
            id="description" 
            name="description" 
            required 
            placeholder="예: 이마트 간식 구매"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all" 
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label htmlFor="category" className="text-sm font-bold text-zinc-500 ml-1">분류 (카테고리) *</label>
          <select 
            id="category" 
            name="category" 
            required
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          >
            <option value="">선택해주세요</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-bold text-zinc-500 ml-1">등록 상태 *</label>
          <select 
            id="status" 
            name="status" 
            required
            defaultValue="pending"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          >
            <option value="pending">임시저장 (잔액 미변경)</option>
            <option value="confirmed">최종 확정 (잔액 즉시 차감)</option>
          </select>
        </div>

        {/* Memo */}
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="memo" className="text-sm font-bold text-zinc-500 ml-1">추가 메모 (선택)</label>
          <textarea 
            id="memo" 
            name="memo" 
            rows={3}
            placeholder="영수증 번호나 특이사항을 적어주세요"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all" 
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
        <button 
          type="button" 
          onClick={() => router.back()}
          className="px-6 py-3 border-2 border-zinc-200 text-zinc-600 rounded-xl font-bold hover:bg-zinc-50 transition-all"
          disabled={loading}
        >
          취소
        </button>
        <button 
          type="submit" 
          className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:bg-zinc-300"
          disabled={loading}
        >
          {loading ? '저장 중...' : '기록 저장'}
        </button>
      </div>

    </form>
  )
}
