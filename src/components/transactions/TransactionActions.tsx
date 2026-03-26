'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTransactionStatus, deleteTransaction } from '@/app/actions/transaction'

export default function TransactionActions({ 
  transactionId, 
  currentStatus 
}: { 
  transactionId: string
  currentStatus: 'pending' | 'confirmed' 
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!confirm('정말 이 결제 내역을 확정하시겠습니까?\n(확인 시 즉시 잔액이 차감됩니다.)')) return
    setLoading(true)
    try {
      await updateTransactionStatus(transactionId, 'confirmed')
      router.refresh()
    } catch (error) {
      alert('상태 변경에 실패했습니다.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 내역을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.')) return
    setDeleting(true)
    try {
      await deleteTransaction(transactionId)
      router.refresh()
    } catch (error) {
      alert('삭제에 실패했습니다.')
      console.error(error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex justify-center gap-2 flex-wrap">
      {currentStatus === 'pending' && (
        <button 
          onClick={handleConfirm}
          disabled={loading || deleting}
          aria-label="이 거래를 확정합니다"
          className="text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:bg-green-300 min-h-[36px]"
        >
          {loading ? '처리중...' : '✅ 확정하기'}
        </button>
      )}
      <button 
        onClick={handleDelete}
        disabled={loading || deleting}
        aria-label="이 거래를 삭제합니다"
        className="text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:bg-red-300 min-h-[36px]"
      >
        {deleting ? '삭제중...' : '🗑️ 삭제'}
      </button>
    </div>
  )
}
