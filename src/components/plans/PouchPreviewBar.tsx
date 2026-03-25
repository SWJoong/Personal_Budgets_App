'use client'

import { formatCurrency } from '@/utils/budget-visuals'

interface PlanOption {
  name: string
  cost: number
}

interface Props {
  currentBalance: number
  totalBudget: number
  options: PlanOption[]
  selectedIndex: number | null
}

const OPTION_COLORS = [
  { fill: '#3b82f6', dash: '#2563eb', label: '파랑' },  // A
  { fill: '#22c55e', dash: '#16a34a', label: '초록' },  // B
  { fill: '#f97316', dash: '#ea580c', label: '주황' },  // C
]

export default function PouchPreviewBar({ currentBalance, totalBudget, options, selectedIndex }: Props) {
  const balancePercent = totalBudget > 0 ? Math.min((currentBalance / totalBudget) * 100, 100) : 0
  
  return (
    <div className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">예산 미리보기</span>
        <span className="text-sm font-black text-zinc-700">
          잔액: {formatCurrency(currentBalance)}원
        </span>
      </div>

      {/* 미리보기 바 */}
      <div className="relative h-10 w-full bg-zinc-100 rounded-full overflow-hidden">
        {/* 현재 잔액 바 */}
        <div
          className="absolute inset-y-0 left-0 bg-zinc-300 rounded-full transition-all duration-500"
          style={{ width: `${balancePercent}%` }}
        />

        {/* 선택지별 점선 오버레이 */}
        {options.map((option, i) => {
          const costPercent = totalBudget > 0 ? (option.cost / totalBudget) * 100 : 0
          const startPercent = balancePercent - costPercent
          const color = OPTION_COLORS[i] || OPTION_COLORS[0]
          const isSelected = selectedIndex === i

          if (costPercent <= 0) return null

          return (
            <div
              key={i}
              className={`absolute inset-y-1 rounded-full transition-all duration-500 ${
                isSelected ? 'opacity-100' : 'opacity-30'
              }`}
              style={{
                left: `${Math.max(startPercent, 0)}%`,
                width: `${Math.min(costPercent, balancePercent)}%`,
                background: `repeating-linear-gradient(90deg, ${color.fill}44 0px, ${color.fill}44 6px, transparent 6px, transparent 10px)`,
                borderLeft: `3px solid ${color.dash}`,
                borderRight: `3px solid ${color.dash}`,
              }}
            />
          )
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mt-3">
        {options.map((option, i) => {
          const color = OPTION_COLORS[i] || OPTION_COLORS[0]
          const isSelected = selectedIndex === i
          const remaining = currentBalance - option.cost
          
          return (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs font-bold transition-opacity ${
                isSelected ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm border-2"
                style={{
                  borderColor: color.dash,
                  background: `repeating-linear-gradient(90deg, ${color.fill}66 0px, ${color.fill}66 2px, transparent 2px, transparent 4px)`
                }}
              />
              <span className="text-zinc-600">{option.name}</span>
              {isSelected && (
                <span className={remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                  → {formatCurrency(remaining)}원
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
