'use client'

export interface WaterCupChartProps {
  totalBudget: number
  currentSpend: number
}

export default function WaterCupChart({ totalBudget, currentSpend }: WaterCupChartProps) {
  const remainingRatio = Math.max(0, Math.min(100, ((totalBudget - currentSpend) / totalBudget) * 100))
  const isOver = currentSpend > totalBudget

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <h3 className="text-sm font-semibold text-zinc-700">월 예산 현황</h3>
      </div>

      {/* Cup Container */}
      <div className="relative w-32 h-48">
        {/* Cup Border */}
        <div className="absolute inset-0 border-4 border-blue-300 rounded-b-3xl rounded-t-lg bg-white overflow-hidden">
          {/* Water Fill - Animated */}
          <div
            className={`absolute bottom-0 w-full transition-all duration-1500 ease-in-out ${
              isOver ? 'bg-red-400' : 'bg-blue-500'
            } opacity-70`}
            style={{ height: `${remainingRatio}%` }}
          />
        </div>

        {/* Cup Handle */}
        <div className="absolute -right-3 top-6 h-12 w-4 border-4 border-blue-300 rounded-r-full" />

        {/* Text Display - Floating on water */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-zinc-700 drop-shadow-md">
            {remainingRatio.toFixed(0)}%
          </span>
          <span className="text-xs text-zinc-500 mt-1 drop-shadow-sm">
            {isOver ? '초과' : '남음'}
          </span>
        </div>
      </div>

      {/* Budget Info */}
      <div className="text-center space-y-1">
        <div className="text-xs text-zinc-500">
          <span className="block">사용: {(currentSpend / 10000).toFixed(0)}만원</span>
          <span className="block">남음: {(Math.max(0, totalBudget - currentSpend) / 10000).toFixed(0)}만원</span>
        </div>
      </div>
    </div>
  )
}
