'use client'

import { formatCurrency } from '@/utils/budget-visuals'

interface MonthlyData {
  month: string  // 'YYYY-MM'
  totalSpent: number
  budget: number
}

interface Props {
  monthlyData: MonthlyData[]
}

export default function BudgetTrendChart({ monthlyData }: Props) {
  if (monthlyData.length === 0) return null

  const maxAmount = Math.max(...monthlyData.map(d => Math.max(d.totalSpent, d.budget)), 1)
  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">월별 지출 추이</h3>
      <div className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm">
        {/* 범례 */}
        <div className="flex items-center gap-4 mb-5 text-[11px] font-bold text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-blue-500" />
            지출
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-zinc-300 border-2 border-dashed border-zinc-500" />
            예산 기준선
          </span>
        </div>

        {/* SVG 차트 */}
        <svg viewBox={`0 0 ${monthlyData.length * 60} 140`} className="w-full h-32" preserveAspectRatio="none">
          {/* 예산 기준선 (점선) */}
          {monthlyData.map((d, i) => {
            const budgetH = (d.budget / maxAmount) * 110
            return (
              <line
                key={`budget-${i}`}
                x1={i * 60 + 10}
                x2={i * 60 + 50}
                y1={130 - budgetH}
                y2={130 - budgetH}
                stroke="#71717a"
                strokeWidth="2.5"
                strokeDasharray="5 3"
              />
            )
          })}

          {/* 지출 막대 */}
          {monthlyData.map((d, i) => {
            const barH = Math.max((d.totalSpent / maxAmount) * 110, 4)
            const isCurrentMonth = d.month === currentMonth
            const isOverBudget = d.totalSpent > d.budget && d.budget > 0

            let barFill = isCurrentMonth ? '#3b82f6' : '#93c5fd'
            if (isOverBudget) barFill = '#ef4444'

            return (
              <g key={`bar-${i}`}>
                <rect
                  x={i * 60 + 12}
                  y={130 - barH}
                  width="36"
                  height={barH}
                  rx="8"
                  fill={barFill}
                  className="transition-all duration-700"
                  opacity={isCurrentMonth ? 1 : 0.85}
                />
                {/* 금액 (상단) */}
                {d.totalSpent > 0 && (
                  <text
                    x={i * 60 + 30}
                    y={130 - barH - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="900"
                    fill={isOverBudget ? '#dc2626' : '#52525b'}
                  >
                    {d.totalSpent >= 10000
                      ? `${Math.round(d.totalSpent / 10000)}만`
                      : formatCurrency(d.totalSpent)
                    }
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* 월 라벨 */}
        <div className="flex">
          {monthlyData.map((d, i) => {
            const monthNum = Number(d.month.split('-')[1])
            const isCurrentMonth = d.month === currentMonth
            return (
              <div
                key={`label-${i}`}
                className="flex-1 text-center"
              >
                <span className={`text-[10px] font-black ${
                  isCurrentMonth ? 'text-blue-600' : 'text-zinc-400'
                }`}>
                  {monthNum}월
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
