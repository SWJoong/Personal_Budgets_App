'use client'

import { useState } from 'react'

interface Participant {
  id: string
  monthly_budget_default?: number
}

interface BudgetEditModalProps {
  participant: Participant
  onClose: () => void
  onSuccess: () => void
}

export default function BudgetEditModal({ participant, onClose, onSuccess }: BudgetEditModalProps) {
  const [monthlyBudget, setMonthlyBudget] = useState(participant.monthly_budget_default?.toString() || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/budgets/${participant.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthly_budget_default: Number(monthlyBudget) || 0,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update budget')
      }

      onSuccess()
    } catch (error) {
      console.error('Error updating budget:', error)
      alert('예산 수정에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">기본 예산 수정</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">
              월별 기본 예산 (원)
            </label>
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 500000"
              min="0"
              step="1000"
            />
            <p className="text-sm text-zinc-500 mt-1">
              재원 목록에 등록된 재원의 합계가 우선 적용됩니다.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg font-semibold hover:bg-zinc-300"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-zinc-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
