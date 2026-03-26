'use client'

import { useState, useEffect } from 'react'

interface Profile {
  id: string
  name: string
  email: string
}

interface BudgetAssignmentModalProps {
  participantId: string
  participantName: string
  currentSupporterId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function BudgetAssignmentModal({
  participantId,
  participantName,
  currentSupporterId,
  onClose,
  onSuccess
}: BudgetAssignmentModalProps) {
  const [supporters, setSupporters] = useState<Profile[]>([])
  const [selectedSupporterId, setSelectedSupporterId] = useState(currentSupporterId || '')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchSupporters()
  }, [])

  const fetchSupporters = async () => {
    try {
      const response = await fetch('/api/supporters')
      if (!response.ok) throw new Error('Failed to fetch supporters')
      const data = await response.json()
      setSupporters(data)
    } catch (error) {
      console.error('Error fetching supporters:', error)
      alert('지원자 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/participants/${participantId}/assign-supporter`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supporter_id: selectedSupporterId || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to assign supporter')
      }

      onSuccess()
    } catch (error) {
      console.error('Error assigning supporter:', error)
      alert('지원자 배정에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">지원자 배정</h2>
        <p className="text-sm text-zinc-600 mb-4">
          <span className="font-semibold">{participantName}</span>님에게 배정할 지원자를 선택하세요.
        </p>

        {isLoading ? (
          <div className="py-8 text-center text-zinc-500">
            지원자 목록을 불러오는 중...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">
                담당 지원자
              </label>
              <select
                value={selectedSupporterId}
                onChange={(e) => setSelectedSupporterId(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">미배정</option>
                {supporters.map((supporter) => (
                  <option key={supporter.id} value={supporter.id}>
                    {supporter.name} ({supporter.email})
                  </option>
                ))}
              </select>
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
                {isSubmitting ? '배정 중...' : '배정'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
