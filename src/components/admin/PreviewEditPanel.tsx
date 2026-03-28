'use client'

import { useState } from 'react'
import { updateParticipant } from '@/app/actions/admin'
import { formatCurrency } from '@/utils/budget-visuals'

interface Participant {
  id: string
  name: string
  email: string
  monthly_budget_default: number
  yearly_budget_default: number
  budget_start_date: string
  budget_end_date: string
  alert_threshold: number
}

interface PreviewEditPanelProps {
  participant: Participant
  isVisible: boolean
  onSave: () => void
}

export default function PreviewEditPanel({ participant, isVisible, onSave }: PreviewEditPanelProps) {
  const [formData, setFormData] = useState({
    name: participant.name || '',
    email: participant.email || '',
    monthlyBudget: participant.monthly_budget_default || 0,
    yearlyBudget: participant.yearly_budget_default || 0,
    startDate: participant.budget_start_date || '',
    endDate: participant.budget_end_date || '',
    alertThreshold: participant.alert_threshold || 0,
  })
  const [isSaving, setIsSaving] = useState(false)

  if (!isVisible) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateParticipant(participant.id, formData)
      if (result.error) {
        alert(`저장 실패: ${result.error}`)
      } else {
        alert('저장되었습니다!')
        onSave()
      }
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-40 overflow-y-auto border-l-4 border-blue-500">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900">당사자 정보 편집</h2>
          <span className="text-2xl">✏️</span>
        </div>

        <div className="flex flex-col gap-4">
          {/* 이름 */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1">이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1">이메일</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 월 예산 */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1">월 예산</label>
            <input
              type="number"
              value={formData.monthlyBudget}
              onChange={(e) => setFormData({ ...formData, monthlyBudget: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(formData.monthlyBudget)}원</p>
          </div>

          {/* 연 예산 */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1">연 예산</label>
            <input
              type="number"
              value={formData.yearlyBudget}
              onChange={(e) => setFormData({ ...formData, yearlyBudget: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(formData.yearlyBudget)}원</p>
          </div>

          {/* 운영 기간 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-zinc-600 mb-1">시작일</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-2 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-600 mb-1">종료일</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-2 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* 경고 기준액 */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 mb-1">경고 기준액</label>
            <input
              type="number"
              value={formData.alertThreshold}
              onChange={(e) => setFormData({ ...formData, alertThreshold: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(formData.alertThreshold)}원</p>
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full mt-4 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '저장 중...' : '💾 저장하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
