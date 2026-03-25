"use client"

import { useState } from 'react'
import { formatCurrency } from '@/utils/budget-visuals'
import PouchPreviewBar from './PouchPreviewBar'

interface PlanOption {
  name: string
  cost: number
  time: string
  icon: string
  description?: string
}

interface Props {
  activityName: string
  initialOptions: PlanOption[]
  currentBalance: number
  totalBudget?: number
  onSelect?: (index: number) => void
}

export default function PlanComparison({ activityName, initialOptions, currentBalance, totalBudget, onSelect }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const handleSelect = (index: number) => {
    setSelectedIndex(index)
    if (onSelect) onSelect(index)
  }

  const budget = totalBudget || currentBalance

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-zinc-900 mb-2">"{activityName}"</h2>
        <p className="text-zinc-500 font-bold">어떤 방법이 더 좋을까요?</p>
      </div>

      {/* P5: 선택지별 색깔 점선 오버레이 바 */}
      <PouchPreviewBar
        currentBalance={currentBalance}
        totalBudget={budget}
        options={initialOptions.map(o => ({ name: o.name, cost: o.cost }))}
        selectedIndex={selectedIndex}
      />

      <div className="grid grid-cols-1 gap-4">
        {initialOptions.map((option, index) => {
          const isSelected = selectedIndex === index
          const remainingAfter = currentBalance - option.cost
          const isOverBudget = remainingAfter < 0

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              className={`
                relative flex flex-col p-6 rounded-[2.5rem] text-left transition-all duration-300 ring-2
                ${isSelected 
                  ? 'bg-zinc-900 ring-zinc-900 shadow-xl scale-[1.02] z-10' 
                  : 'bg-white ring-zinc-100 hover:ring-zinc-300 shadow-sm active:scale-95'}
              `}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1">
                  <span className={`text-sm font-black uppercase tracking-widest ${isSelected ? 'text-zinc-400' : 'text-zinc-300'}`}>
                    방법 {index + 1}
                  </span>
                  <h3 className={`text-xl font-black ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                    {option.name}
                  </h3>
                </div>
                <span className="text-4xl">{option.icon}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${isSelected ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                  <p className={`text-[10px] font-bold mb-0.5 ${isSelected ? 'text-zinc-500' : 'text-zinc-400'}`}>비용</p>
                  <p className={`font-black ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                    {formatCurrency(option.cost)}원
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${isSelected ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                  <p className={`text-[10px] font-bold mb-0.5 ${isSelected ? 'text-zinc-500' : 'text-zinc-400'}`}>시간</p>
                  <p className={`font-black ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                    {option.time}
                  </p>
                </div>
              </div>

              <div className={`mt-auto pt-4 border-t ${isSelected ? 'border-zinc-800' : 'border-zinc-100'}`}>
                <p className={`text-xs font-bold mb-1 ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  이걸 선택하면 남는 돈
                </p>
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-black ${
                    isOverBudget ? 'text-red-500' : isSelected ? 'text-green-400' : 'text-zinc-900'
                  }`}>
                    {formatCurrency(remainingAfter)}원
                  </span>
                  {isOverBudget && (
                    <span className="px-2 py-1 rounded-lg bg-red-100 text-[10px] font-black text-red-600">예산 부족</span>
                  )}
                </div>
              </div>

              {isSelected && (
                <div className="absolute -top-3 -right-3 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
                  <span className="text-xl">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedIndex !== null && (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-4">
          <button 
            className="w-full py-5 rounded-3xl bg-primary text-primary-foreground text-xl font-black shadow-xl active:scale-95 transition-all"
            onClick={() => alert('선택하신 계획이 저장되었습니다!')}
          >
            이걸로 결정하기 👍
          </button>
        </div>
      )}
    </div>
  )
}
