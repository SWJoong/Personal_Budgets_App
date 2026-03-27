'use client'

import { formatCurrency } from '@/utils/budget-visuals'

interface PlanOption {
  name: string
  cost: number
  icon?: string
}

interface WaterCupPlanPreviewProps {
  currentBalance: number
  totalBudget: number
  options: PlanOption[]
  selectedIndex: number | null
}

const OPTION_COLORS = [
  { water: '#3b82f6', dash: '#2563eb', bg: '#eff6ff', text: '#1d4ed8' },
  { water: '#22c55e', dash: '#16a34a', bg: '#f0fdf4', text: '#15803d' },
  { water: '#f97316', dash: '#ea580c', bg: '#fff7ed', text: '#c2410c' },
]

export default function WaterCupPlanPreview({
  currentBalance,
  totalBudget,
  options,
  selectedIndex,
}: WaterCupPlanPreviewProps) {
  const budget = totalBudget || currentBalance

  // 선택된 옵션의 비용으로 실제 물 높이 계산
  const displayBalance = selectedIndex !== null
    ? currentBalance - options[selectedIndex].cost
    : currentBalance

  const displayRatio = budget > 0
    ? Math.max(0, Math.min(100, (displayBalance / budget) * 100))
    : 0

  const currentRatio = budget > 0
    ? Math.max(0, Math.min(100, (currentBalance / budget) * 100))
    : 0

  const isOver = displayBalance < 0
  const waterColor = isOver ? '#ef4444' : selectedIndex !== null
    ? OPTION_COLORS[selectedIndex % OPTION_COLORS.length].water
    : '#3b82f6'

  return (
    <div className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">예산 미리보기</span>
        <span className="text-sm font-black text-zinc-700">
          잔액: {formatCurrency(Math.max(0, displayBalance))}원
        </span>
      </div>

      {/* 물컵 + 범례 레이아웃 */}
      <div className="flex items-end gap-6">
        {/* 물컵 시각화 */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative w-24 h-40">
            {/* 컵 테두리 */}
            <div className="absolute inset-0 border-4 border-zinc-300 rounded-b-3xl rounded-t-lg bg-zinc-50 overflow-hidden">
              {/* 현재 잔액 물 (선택 전 기준선) */}
              {selectedIndex !== null && (
                <div
                  className="absolute bottom-0 w-full bg-zinc-200 transition-none"
                  style={{ height: `${currentRatio}%`, opacity: 0.4 }}
                />
              )}

              {/* 선택된 옵션의 물 높이 */}
              <div
                className="absolute bottom-0 w-full transition-all duration-700 ease-in-out"
                style={{
                  height: `${displayRatio}%`,
                  backgroundColor: waterColor,
                  opacity: 0.75,
                }}
              />

              {/* 각 옵션별 점선 수위 표시 */}
              {options.map((option, i) => {
                const remaining = currentBalance - option.cost
                const ratio = budget > 0 ? Math.max(0, Math.min(100, (remaining / budget) * 100)) : 0
                const color = OPTION_COLORS[i % OPTION_COLORS.length]
                const isSelected = selectedIndex === i
                return (
                  <div
                    key={i}
                    className="absolute w-full transition-all duration-300"
                    style={{
                      bottom: `${ratio}%`,
                      borderTop: `2px dashed ${color.dash}`,
                      opacity: isSelected ? 1 : 0.5,
                    }}
                  >
                    <span
                      className="absolute -right-1 -top-3 text-[9px] font-black px-1 rounded"
                      style={{ color: color.dash, backgroundColor: color.bg }}
                    >
                      {i + 1}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 컵 손잡이 */}
            <div className="absolute -right-3 top-6 h-10 w-3.5 border-4 border-zinc-300 rounded-r-full" />

            {/* 퍼센트 표시 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-black drop-shadow-sm ${isOver ? 'text-red-600' : 'text-zinc-700'}`}>
                {Math.round(displayRatio)}%
              </span>
            </div>
          </div>

          <span className="text-[10px] font-bold text-zinc-400">남은 돈</span>
        </div>

        {/* 옵션별 범례 */}
        <div className="flex-1 flex flex-col gap-3">
          {options.map((option, i) => {
            const remaining = currentBalance - option.cost
            const color = OPTION_COLORS[i % OPTION_COLORS.length]
            const isSelected = selectedIndex === i
            const isOptionOver = remaining < 0

            return (
              <div
                key={i}
                className={`flex items-center gap-2 p-3 rounded-xl transition-all duration-300 ${
                  isSelected ? 'ring-2 shadow-sm' : 'opacity-50'
                }`}
                style={{
                  backgroundColor: isSelected ? color.bg : undefined,
                  borderColor: isSelected ? color.dash : undefined,
                  ringColor: color.dash,
                }}
              >
                {/* 점선 색상 마커 */}
                <div
                  className="w-4 h-4 rounded-sm shrink-0 border-2"
                  style={{
                    borderColor: color.dash,
                    background: `repeating-linear-gradient(90deg, ${color.water}66 0px, ${color.water}66 3px, transparent 3px, transparent 6px)`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-zinc-700 truncate">{option.name}</p>
                  <p className="text-[10px] font-bold text-zinc-400">-{formatCurrency(option.cost)}원</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-black ${isOptionOver ? 'text-red-600' : isSelected ? 'text-zinc-800' : 'text-zinc-500'}`}>
                    {isOptionOver ? '예산 초과' : formatCurrency(remaining) + '원'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 현재 잔액 기준 표시 */}
      <div className="mt-4 pt-3 border-t border-zinc-100 flex justify-between text-[10px] font-bold text-zinc-400">
        <span>현재 잔액: {formatCurrency(currentBalance)}원</span>
        {selectedIndex !== null && (
          <span className={displayBalance < 0 ? 'text-red-500' : 'text-zinc-600'}>
            선택 후: {formatCurrency(Math.max(0, displayBalance))}원
          </span>
        )}
      </div>
    </div>
  )
}
