'use client'

import { useState } from 'react'
import { updateParticipant } from '@/app/actions/admin'
import { formatCurrency } from '@/utils/budget-visuals'
import { saveUIPreferences } from '@/app/actions/preferences'
import { UIPreferences, DEFAULT_PREFERENCES, OPTIONAL_BLOCKS, BLOCK_METADATA, BlockId } from '@/types/ui-preferences'

interface Participant {
  id: string
  name: string
  email: string
  monthly_budget_default: number
  yearly_budget_default: number
  budget_start_date: string
  budget_end_date: string
  alert_threshold: number
  ui_preferences?: UIPreferences | null
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
  const [blockPrefs, setBlockPrefs] = useState<UIPreferences>(
    participant.ui_preferences ?? DEFAULT_PREFERENCES
  )
  const [isSavingBlocks, setIsSavingBlocks] = useState(false)

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

          {/* 구분선 */}
          <hr className="my-2 border-zinc-200" />

          {/* 홈 화면 블록 설정 */}
          <div>
            <h3 className="text-sm font-bold text-zinc-700 mb-3">🧩 홈 화면 블록 설정</h3>
            <div className="flex flex-col gap-2">
              {OPTIONAL_BLOCKS.map((blockId: BlockId) => {
                const meta = BLOCK_METADATA[blockId]
                const isEnabled = blockPrefs.enabled_blocks.includes(blockId)
                return (
                  <label
                    key={blockId}
                    className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => {
                        const current = new Set(blockPrefs.enabled_blocks)
                        if (current.has(blockId)) {
                          current.delete(blockId)
                        } else {
                          current.add(blockId)
                        }
                        setBlockPrefs({ enabled_blocks: OPTIONAL_BLOCKS.filter(b => current.has(b)) })
                      }}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-base">{meta.icon}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-700">{meta.label}</span>
                      <span className="text-[10px] text-zinc-400">{meta.description}</span>
                    </div>
                  </label>
                )
              })}
            </div>
            <button
              onClick={async () => {
                setIsSavingBlocks(true)
                try {
                  await saveUIPreferences(participant.id, blockPrefs)
                  alert('블록 설정이 저장되었습니다!')
                } catch {
                  alert('저장 중 오류가 발생했습니다.')
                } finally {
                  setIsSavingBlocks(false)
                }
              }}
              disabled={isSavingBlocks}
              className="w-full mt-3 px-4 py-2.5 bg-zinc-900 text-white font-bold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 text-sm"
            >
              {isSavingBlocks ? '저장 중...' : '블록 설정 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
