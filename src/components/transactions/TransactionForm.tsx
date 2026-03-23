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
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 max-w-2xl mx-auto space-y-6">
      
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date */}
        <div className="space-y-2">
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">활동/결제 일자 *</label>
          <input 
            type="date" 
            id="date" 
            name="date" 
            required 
            defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>

        {/* Funding Source */}
        <div className="space-y-2">
          <label htmlFor="funding_source_id" className="block text-sm font-medium text-gray-700">결제 수단 (재원) *</label>
          <select 
            id="funding_source_id" 
            name="funding_source_id" 
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">선택해주세요</option>
            {fundingSources.map(fs => (
              <option key={fs.id} value={fs.id}>{fs.name}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">결제 금액 *</label>
          <input 
            type="number" 
            id="amount" 
            name="amount" 
            min="0"
            required 
            placeholder="예: 15000"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>

        {/* Type (Expense/Income) */}
        <div className="space-y-2">
          <label htmlFor="is_expense" className="block text-sm font-medium text-gray-700">구분 *</label>
          <select 
            id="is_expense" 
            name="is_expense" 
            required
            defaultValue="true"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">지출 (잔액 차감)</option>
            <option value="false">수입 (잔액 증가)</option>
          </select>
        </div>

        {/* Description */}
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">활동명 (품목명) *</label>
          <input 
            type="text" 
            id="description" 
            name="description" 
            required 
            placeholder="예: 이마트 간식 구매"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">분류 (카테고리) *</label>
          <select 
            id="category" 
            name="category" 
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">선택해주세요</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">등록 상태 *</label>
          <select 
            id="status" 
            name="status" 
            required
            defaultValue="pending"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pending">임시저장 (잔액 미변경)</option>
            <option value="confirmed">최종 확정 (잔액 즉시 차감)</option>
          </select>
        </div>

        {/* Memo */}
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="memo" className="block text-sm font-medium text-gray-700">추가 메모 (선택)</label>
          <textarea 
            id="memo" 
            name="memo" 
            rows={3}
            placeholder="영수증 번호나 특이사항을 적어주세요"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
        <button 
          type="button" 
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none"
          disabled={loading}
        >
          취소
        </button>
        <button 
          type="submit" 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:bg-blue-400"
          disabled={loading}
        >
          {loading ? '저장 중...' : '기록 저장'}
        </button>
      </div>

    </form>
  )
}
