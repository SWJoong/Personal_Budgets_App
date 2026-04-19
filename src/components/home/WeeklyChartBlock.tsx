'use client'

import { useState } from 'react'
import Image from 'next/image'
import { formatCurrency } from '@/utils/budget-visuals'
import { EasyTerm } from '@/components/ui/EasyTerm'
import ImageLightbox from '@/components/ui/ImageLightbox'

interface DailyTransaction {
  date: string
  amount: number
  activity_name: string
  status: 'pending' | 'confirmed'
  receipt_image_url?: string | null
  activity_image_url?: string | null
}

interface Props {
  dailyTransactions: DailyTransaction[]
  themeColor: string
}

const THEME = {
  green:  { fill: '#22c55e', bg: 'bg-green-500' },
  blue:   { fill: '#3b82f6', bg: 'bg-blue-500' },
  indigo: { fill: '#6366f1', bg: 'bg-indigo-500' },
  orange: { fill: '#f97316', bg: 'bg-orange-500' },
  red:    { fill: '#ef4444', bg: 'bg-red-500' },
  zinc:   { fill: '#71717a', bg: 'bg-zinc-500' },
} as const

type ThemeKey = keyof typeof THEME

export default function WeeklyChartBlock({ dailyTransactions, themeColor }: Props) {
  const c = THEME[(themeColor as ThemeKey)] ?? THEME.zinc
  const today = new Date()
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

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

  const todayStr = today.toISOString().split('T')[0]
  const selectedTxs = selectedDay
    ? (dailyTotals.find(d => d.date === selectedDay)?.transactions ?? [])
    : []

  return (
    <section className="rounded-[2rem] bg-white ring-1 ring-zinc-100 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">
          <EasyTerm formal="이번 주 지출" easy="이번 주에 쓴 돈" />
        </h3>
      </div>

      {/* 2×7 그리드: 날짜 + 활동사진 */}
      <div className="grid grid-cols-7 gap-1.5 px-4 pb-4">
        {dailyTotals.map(day => {
          // 활동사진 우선, 없으면 영수증 사진
          const photo =
            day.transactions.find(t => t.activity_image_url)?.activity_image_url ??
            day.transactions.find(t => t.receipt_image_url)?.receipt_image_url ??
            null
          const hasActivity = day.transactions.length > 0
          const isToday = day.date === todayStr
          const isSelected = selectedDay === day.date

          return (
            <button
              key={day.date}
              onClick={() => setSelectedDay(isSelected ? null : day.date)}
              className="flex flex-col items-center gap-1.5 group"
              aria-pressed={isSelected}
            >
              {/* 날짜 라벨 */}
              <span
                className="text-[9px] font-black leading-none"
                style={{ color: isToday ? c.fill : '#a1a1aa' }}
              >
                {day.label}
              </span>

              {/* 사진 / 상태 칸 */}
              <div
                className={`w-full aspect-square rounded-xl overflow-hidden transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 ring-zinc-900 ring-offset-1 scale-105'
                    : hasActivity
                    ? 'ring-1 ring-zinc-200 group-hover:ring-zinc-400'
                    : 'ring-1 ring-zinc-100'
                }`}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt={day.label}
                    className="w-full h-full object-cover cursor-zoom-in"
                    onClick={e => { e.stopPropagation(); setLightboxSrc(photo) }}
                  />
                ) : hasActivity ? (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: isSelected ? '#18181b' : `${c.fill}18` }}
                  >
                    <span className="text-base">
                      {day.transactions[0]?.status === 'confirmed' ? '✅' : '⏳'}
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full bg-zinc-50" />
                )}
              </div>

              {/* 금액 */}
              {day.total > 0 && (
                <span className="text-[8px] font-black text-zinc-500 leading-none">
                  {day.total >= 10000
                    ? `${Math.round(day.total / 10000)}만`
                    : formatCurrency(day.total)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 선택된 날 세부 내역 */}
      {selectedDay && (
        <div className="px-5 pb-5 pt-2 border-t border-zinc-50 animate-fade-in-up">
          {selectedTxs.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h5 className="text-xs font-black text-zinc-400 mb-1">
                {selectedDay.split('-')[1]}월 {selectedDay.split('-')[2]}일
              </h5>
              {selectedTxs.map((tx, i) => {
                const thumb = tx.activity_image_url || tx.receipt_image_url
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50">
                    {thumb ? (
                      <button
                        className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-zinc-200 cursor-zoom-in"
                        onClick={() => setLightboxSrc(thumb)}
                      >
                        <Image src={thumb} alt="활동" fill sizes="48px" className="object-cover" />
                      </button>
                    ) : (
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                        tx.status === 'confirmed' ? 'bg-green-50' : 'bg-orange-50'
                      }`}>
                        {tx.status === 'confirmed' ? '✅' : '⏳'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-800 text-sm truncate">{tx.activity_name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {tx.status === 'confirmed' ? '확인됨' : '확인 중'}
                      </p>
                    </div>
                    <span className="font-black text-zinc-900 text-sm shrink-0">
                      -{formatCurrency(Number(tx.amount))}원
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <span className="text-3xl opacity-30">💤</span>
              <p className="text-sm text-zinc-400 font-bold mt-2">이 날은 지출이 없었어요</p>
            </div>
          )}
        </div>
      )}

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </section>
  )
}
