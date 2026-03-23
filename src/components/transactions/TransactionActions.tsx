'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTransactionStatus } from '@/app/actions/transaction'

export default function TransactionActions({ 
  transactionId, 
  currentStatus 
}: { 
  transactionId: string
  currentStatus: 'pending' | 'confirmed' 
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!confirm('정말 이 결제 내역을 확정하시겠습니까?\\n(확인 시 즉시 잔액이 차감됩니다.)')) return

    setLoading(true)
    try {
      await updateTransactionStatus(transactionId, 'confirmed')
      router.refresh() // Refresh the server component to get new data
    } catch (error) {
      alert('상태 변경에 실패했습니다.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center space-x-2">
      {currentStatus === 'pending' && (
        <button 
          onClick={handleConfirm}
          disabled={loading}
          className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs font-medium transition disabled:bg-green-400"
        >
          {loading ? '처리중' : '확정하기'}
        </button>
      )}
      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1">상세</button>
    </div>
  )
}
