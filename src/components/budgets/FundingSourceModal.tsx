'use client'

import { useState } from 'react'

interface FundingSource {
  id: string
  name: string
  monthly_budget: number
  description?: string
}

interface FundingSourceModalProps {
  participantId: string
  fundingSource: FundingSource | null
  onClose: () => void
  onSuccess: () => void
}

export default function FundingSourceModal({
  participantId,
  fundingSource,
  onClose,
  onSuccess
}: FundingSourceModalProps) {
  const [name, setName] = useState(fundingSource?.name || '')
  const [monthlyBudget, setMonthlyBudget] = useState(fundingSource?.monthly_budget.toString() || '')
  const [description, setDescription] = useState(fundingSource?.description || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isEditMode = !!fundingSource

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = isEditMode
        ? `/api/funding-sources/${fundingSource.id}`
        : '/api/funding-sources'

      const response = await fetch(url, {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participant_id: participantId,
          name,
          monthly_budget: Number(monthlyBudget),
          description: description || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save funding source')
      }

      onSuccess()
    } catch (error) {
      console.error('Error saving funding source:', error)
      alert('재원 저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!fundingSource) return

    if (!confirm('정말로 이 재원을 삭제하시겠습니까?')) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/funding-sources/${fundingSource.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete funding source')
      }

      onSuccess()
    } catch (error) {
      console.error('Error deleting funding source:', error)
      alert('재원 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">
          {isEditMode ? '재원 수정' : '재원 추가'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">
              재원 이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 개인예산"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">
              월별 예산 (원) *
            </label>
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 500000"
              min="0"
              step="1000"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="재원에 대한 설명을 입력하세요"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg font-semibold hover:bg-zinc-300"
              disabled={isSubmitting || isDeleting}
            >
              취소
            </button>
            {isEditMode && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:bg-zinc-300"
                disabled={isSubmitting || isDeleting}
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            )}
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-zinc-300"
              disabled={isSubmitting || isDeleting}
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
