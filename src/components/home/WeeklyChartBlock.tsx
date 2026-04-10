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
  dailyTransactions: DailyTransaction[]
  themeColor: string
}

const THEME = {
  green:  { fill: '#22c55e' },
  blue:   { fill: '#3b82f6' },
  indigo: { fill: '#6366f1' },
  orange: { fill: '#f97316' },
  red:    { fill: '#ef4444' },
  zinc:   { fill: '#71717a' },
} as const

type ThemeKey = keyof typeof THEME

export default function WeeklyChartBlock({ dailyTransactions, themeColor }: Props) {
  const c = THEME[(themeColor as ThemeKey)] ?? THEME.zinc
  const today = new Date()
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const dailyTotals = last7Days.map(date => {
    const txs = dailyTransactions.filter(t => t.date === date)
    return {
      date,
      label: `${Number(date.split('-')[1])}/${Number(date.split('-')[2])}`,
      total: txs.reduce((s, t) => s + Number(t.amount), 0),
      transactions: txs,
    }
  })

  const maxDaily = Math.max(...dailyTotals.map(d => d.total), 1)
  const todayStr = today.toISOString().split('T')[0]
  const selectedTxs = selectedDay
    ? (dailyTotals.find(d => d.date === selectedDay)?.transactions ?? [])
    : []

  return (
    <section className="rounded-[2rem] bg-white ring-1 ring-zinc-100 shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-1">
        <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">이번 주 지출</h3>
      </div>

      <div className="flex items-end gap-1.5 h-32 px-6 pb-2">
        {dailyTotals.map(day => {
          const barH = day.total > 0 ? Math.max((day.total / maxDaily) * 100, 8) : 3
          const isSelected = selectedDay === day.date
          const isToday = day.date === todayStr

          return (
            <button
              key={day.date}
              onClick={() => setSelectedDay(isSelected ? null : day.date)}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              {day.total > 0 && (
                <span
                  className={`text-[9px] font-black transition-opacity ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  style={{ color: c.fill }}
                >
                  {formatCurrency(day.total)}
                </span>
              )}
              <div
                className={`w-full rounded-xl transition-all duration-500 ${
                  isSelected ? 'ring-2 ring-offset-1' : 'hover:opacity-80'
                }`}
                style={{
                  height: `${barH}%`,
                  background: day.total > 0
                    ? isToday ? c.fill : `${c.fill}88`
                    : '#f4f4f5',
                }}
              />
              <span
                className="text-[9px] font-bold text-zinc-400"
                style={{ color: isToday ? c.fill : undefined, fontWeight: isToday ? 900 : undefined }}
              >
                {day.label}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="px-6 pb-5 pt-2 border-t border-zinc-50 animate-fade-in-up">
          {selectedTxs.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h5 className="text-xs font-black text-zinc-400 mb-1">
                {selectedDay.split('-')[1]}월 {selectedDay.split('-')[2]}일
              </h5>
              {selectedTxs.map((tx, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50">
                  {tx.receipt_image_url ? (
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
                      <img src={tx.receipt_image_url} alt="영수증" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${
                      tx.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                    }`}>
                      {tx.status === 'confirmed' ? '✓' : '⏳'}
                    </div>
                  )}
                  <p className="flex-1 font-bold text-zinc-800 text-sm truncate">{tx.activity_name}</p>
                  <span className="font-black text-zinc-900 text-sm shrink-0">
                    -{formatCurrency(Number(tx.amount))}원
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <span className="text-3xl opacity-30">💤</span>
              <p className="text-sm text-zinc-400 font-bold mt-2">이 날은 지출이 없었어요</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
