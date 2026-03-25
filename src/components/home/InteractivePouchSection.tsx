'use client'

import { useState } from 'react'
import { formatCurrency } from '@/utils/budget-visuals'

interface DailyTransaction {
  date: string
  amount: number
  activity_name: string
  status: 'pending' | 'confirmed'
  receipt_image_url?: string | null
}

interface Props {
  currentBalance: number
  totalBudget: number
  percentage: number
  themeColor: string
  icon: string
  dailyTransactions: DailyTransaction[]
  remainingDays: number
}

const THEME_COLORS: Record<string, { fill: string; stroke: string; light: string; text: string }> = {
  green:  { fill: '#22c55e', stroke: '#16a34a', light: '#dcfce7', text: 'text-green-700' },
  blue:   { fill: '#3b82f6', stroke: '#2563eb', light: '#dbeafe', text: 'text-blue-700' },
  indigo: { fill: '#6366f1', stroke: '#4f46e5', light: '#e0e7ff', text: 'text-indigo-700' },
  orange: { fill: '#f97316', stroke: '#ea580c', light: '#ffedd5', text: 'text-orange-700' },
  red:    { fill: '#ef4444', stroke: '#dc2626', light: '#fee2e2', text: 'text-red-700' },
  zinc:   { fill: '#71717a', stroke: '#52525b', light: '#f4f4f5', text: 'text-zinc-700' },
}

export default function InteractivePouchSection({
  currentBalance, totalBudget, percentage, themeColor, icon,
  dailyTransactions, remainingDays
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const colors = THEME_COLORS[themeColor] || THEME_COLORS.zinc

  // 최근 7일 데이터 집계
  const today = new Date()
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const dailyTotals = last7Days.map(date => {
    const dayTxs = dailyTransactions.filter(t => t.date === date)
    return {
      date,
      label: `${Number(date.split('-')[1])}/${Number(date.split('-')[2])}`,
      total: dayTxs.reduce((sum, t) => sum + Number(t.amount), 0),
      transactions: dayTxs
    }
  })

  const maxDaily = Math.max(...dailyTotals.map(d => d.total), 1)

  const selectedDayTxs = selectedDay
    ? dailyTotals.find(d => d.date === selectedDay)?.transactions || []
    : []

  // SVG 돈주머니 — 잔액 비율에 따라 크기·모양 변화
  const pouchScale = 0.5 + (percentage / 100) * 0.5 // 0.5 ~ 1.0
  const pouchFill = percentage > 0 ? percentage : 2

  return (
    <section className="flex flex-col gap-4">
      {/* 돈주머니 카드 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full p-8 rounded-[3rem] bg-white ring-1 ring-zinc-200 shadow-lg overflow-hidden transition-all duration-500 active:scale-[0.98] hover:shadow-xl group"
        style={{ background: `linear-gradient(135deg, ${colors.light}, white)` }}
        aria-expanded={isOpen}
        aria-label="돈주머니를 눌러서 지출 차트를 확인하세요"
      >
        <div className="flex items-center justify-between relative z-10">
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">나의 돈주머니</span>
            <span className={`text-3xl sm:text-4xl font-black ${colors.text}`}>
              {formatCurrency(currentBalance)}원
            </span>
            <span className="text-sm font-bold text-zinc-400 mt-1">
              {isOpen ? '차트를 닫으려면 탭하세요' : '탭하면 이번 주 지출을 볼 수 있어요'}
            </span>
          </div>

          {/* SVG 돈주머니 */}
          <div className="relative" style={{ width: 100, height: 100 }}>
            <svg
              viewBox="0 0 100 100"
              className={`w-full h-full transition-transform duration-700 ${isOpen ? 'scale-110' : ''}`}
              style={{ transform: `scale(${pouchScale})` }}
            >
              {/* 주머니 몸체 */}
              <ellipse
                cx="50" cy="60" rx="38" ry="35"
                fill={colors.light}
                stroke={colors.stroke}
                strokeWidth="2.5"
              />
              {/* 잔액 채움 — 아래에서 위로 */}
              <clipPath id="pouch-clip">
                <ellipse cx="50" cy="60" rx="36" ry="33" />
              </clipPath>
              <rect
                x="12" y={95 - pouchFill * 0.7}
                width="76" height={pouchFill * 0.7 + 5}
                fill={colors.fill}
                opacity="0.35"
                clipPath="url(#pouch-clip)"
                className="transition-all duration-1000"
              />
              {/* 주머니 끈 */}
              <path
                d={isOpen
                  ? "M 25 32 Q 35 10 50 15 Q 65 10 75 32" // 열린 상태
                  : "M 25 32 Q 35 22 50 25 Q 65 22 75 32"  // 닫힌 상태
                }
                fill="none"
                stroke={colors.stroke}
                strokeWidth="3"
                strokeLinecap="round"
                className="transition-all duration-500"
              />
              {/* 끈 매듭 */}
              <circle cx="50" cy={isOpen ? 15 : 25} r="4" fill={colors.fill} className="transition-all duration-500" />
              {/* 아이콘 */}
              <text x="50" y="68" textAnchor="middle" fontSize="24" className="select-none">
                {icon}
              </text>
            </svg>
            {/* 퍼센트 뱃지 */}
            <div
              className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg"
              style={{ background: colors.fill }}
            >
              {percentage}%
            </div>
          </div>
        </div>

        {/* 배경 장식 */}
        <div className="absolute -right-8 -bottom-8 text-[10rem] opacity-[0.03] rotate-12 pointer-events-none select-none">
          {icon}
        </div>
      </button>

      {/* 펼쳐지는 차트 영역 */}
      <div className={`transition-all duration-500 overflow-hidden ${
        isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm">
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">이번 주 지출</h3>
          
          {/* SVG 막대 차트 */}
          <div className="flex items-end gap-2 h-40 px-2">
            {dailyTotals.map(day => {
              const barHeight = day.total > 0 ? Math.max((day.total / maxDaily) * 100, 8) : 4
              const isSelected = selectedDay === day.date
              const isToday = day.date === today.toISOString().split('T')[0]
              
              return (
                <button
                  key={day.date}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedDay(isSelected ? null : day.date)
                  }}
                  className="flex-1 flex flex-col items-center gap-1 group"
                >
                  {day.total > 0 && (
                    <span className={`text-[10px] font-black transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    } ${colors.text}`}>
                      {formatCurrency(day.total)}
                    </span>
                  )}
                  <div
                    className={`w-full rounded-xl transition-all duration-500 cursor-pointer ${
                      isSelected ? 'ring-2 ring-offset-2' : 'hover:opacity-80'
                    }`}
                    style={{
                      height: `${barHeight}%`,
                      background: day.total > 0
                        ? isToday ? colors.fill : `${colors.fill}88`
                        : '#f4f4f5',
                      ringColor: colors.fill,
                    }}
                  />
                  <span className={`text-[10px] font-bold ${
                    isToday ? colors.text + ' font-black' : 'text-zinc-400'
                  }`}>
                    {day.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 선택된 날짜 거래 목록 */}
          {selectedDay && selectedDayTxs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col gap-2 animate-fade-in-up">
              <h4 className="text-xs font-black text-zinc-400 mb-1">
                {selectedDay.split('-')[1]}월 {selectedDay.split('-')[2]}일 내역
              </h4>
              {selectedDayTxs.map((tx, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50">
                  {tx.receipt_image_url ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                      <img src={tx.receipt_image_url} alt="영수증" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                      tx.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                    }`}>
                      {tx.status === 'confirmed' ? '✓' : '⏳'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-800 text-sm truncate">{tx.activity_name}</p>
                  </div>
                  <span className="font-black text-zinc-900 text-sm shrink-0">
                    -{formatCurrency(Number(tx.amount))}원
                  </span>
                </div>
              ))}
            </div>
          )}

          {selectedDay && selectedDayTxs.length === 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-100 text-center py-6">
              <span className="text-3xl opacity-40">💤</span>
              <p className="text-sm text-zinc-400 font-bold mt-2">이 날은 지출이 없었어요</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
