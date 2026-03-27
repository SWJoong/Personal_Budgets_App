"use client"

import { useState } from 'react'
import { formatCurrency } from '@/utils/budget-visuals'
import WaterCupPlanPreview from '@/components/charts/WaterCupPlanPreview'
import { savePlan } from '@/app/actions/plan'

interface PlanOption {
  name: string
  cost: number
  time: string
  icon: string
  description?: string
}

interface PlanContext {
  activity?: string
  when?: string
  where?: string
  who?: string
  why?: string
}

interface Props {
  activityName: string
  initialOptions: PlanOption[]
  currentBalance: number
  totalBudget?: number
  participantId?: string
  planContext?: PlanContext
  onSelect?: (index: number) => void
  onSaved?: () => void
}

export default function PlanComparison({
  activityName,
  initialOptions,
  currentBalance,
  totalBudget,
  participantId,
  planContext,
  onSelect,
  onSaved,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSelect = (index: number) => {
    setSelectedIndex(index)
    if (onSelect) onSelect(index)
  }

  const handleSave = async () => {
    if (selectedIndex === null || !participantId) return
    setSaving(true)
    try {
      await savePlan({
        participantId,
        activityName,
        date: new Date().toISOString().split('T')[0],
        options: initialOptions,
        selectedOptionIndex: selectedIndex,
        details: planContext,
      })
      setSaved(true)
      if (onSaved) onSaved()
    } catch {
      alert('저장에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const budget = totalBudget || currentBalance

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-black text-zinc-900 mb-1">"{activityName}"</h2>
        <p className="text-zinc-500 font-bold text-sm">어떤 방법이 더 좋을까요?</p>
      </div>

      {/* 물컵 예산 미리보기 */}
      <WaterCupPlanPreview
        currentBalance={currentBalance}
        totalBudget={budget}
        options={initialOptions.map(o => ({ name: o.name, cost: o.cost, icon: o.icon }))}
        selectedIndex={selectedIndex}
      />

      {/* 선택지 카드 */}
      <div className="grid grid-cols-1 gap-3">
        {initialOptions.map((option, index) => {
          const isSelected = selectedIndex === index
          const remainingAfter = currentBalance - option.cost
          const isOverBudget = remainingAfter < 0

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              className={`
                relative flex flex-col p-5 rounded-[2rem] text-left transition-all duration-300 ring-2
                ${isSelected
                  ? 'bg-zinc-900 ring-zinc-900 shadow-xl scale-[1.01]'
                  : 'bg-white ring-zinc-100 hover:ring-zinc-300 shadow-sm active:scale-95'}
              `}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-0.5">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-zinc-400' : 'text-zinc-300'}`}>
                    방법 {index + 1}
                  </span>
                  <h3 className={`text-lg font-black ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                    {option.name}
                  </h3>
                  {option.description && (
                    <p className={`text-xs font-medium ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>{option.description}</p>
                  )}
                </div>
                <span className="text-3xl">{option.icon}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`p-3 rounded-xl ${isSelected ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                  <p className={`text-[10px] font-bold mb-0.5 ${isSelected ? 'text-zinc-500' : 'text-zinc-400'}`}>비용</p>
                  <p className={`font-black text-base ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                    {formatCurrency(option.cost)}원
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${isSelected ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                  <p className={`text-[10px] font-bold mb-0.5 ${isSelected ? 'text-zinc-500' : 'text-zinc-400'}`}>시간</p>
                  <p className={`font-black text-base ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                    {option.time}
                  </p>
                </div>
              </div>

              <div className={`pt-3 border-t ${isSelected ? 'border-zinc-800' : 'border-zinc-100'}`}>
                <p className={`text-[10px] font-bold mb-1 ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  이걸 선택하면 남는 돈
                </p>
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-black ${
                    isOverBudget ? 'text-red-500' : isSelected ? 'text-green-400' : 'text-zinc-900'
                  }`}>
                    {formatCurrency(Math.max(0, remainingAfter))}원
                  </span>
                  {isOverBudget && (
                    <span className="px-2 py-0.5 rounded-lg bg-red-100 text-[10px] font-black text-red-600">예산 부족</span>
                  )}
                </div>
              </div>

              {isSelected && (
                <div className="absolute -top-3 -right-3 w-9 h-9 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
                  <span className="text-lg">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 저장 버튼 */}
      {selectedIndex !== null && !saved && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-5 rounded-3xl bg-primary text-primary-foreground text-lg font-black shadow-xl active:scale-95 transition-all disabled:bg-zinc-200"
          >
            {saving ? '저장 중...' : '이걸로 결정하기 👍'}
          </button>
        </div>
      )}

      {saved && (
        <div className="p-4 rounded-2xl bg-green-50 ring-1 ring-green-200 text-center">
          <p className="text-green-700 font-black">계획이 저장되었어요!</p>
        </div>
      )}
    </div>
  )
}
