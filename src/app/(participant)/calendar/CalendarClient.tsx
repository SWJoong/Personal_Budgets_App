'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

interface Usage {
  id: string
  usage_date: string
  amount: number
  description: string | null
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function CalendarClient({ usages }: { usages: Usage[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-based
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const byDate = useMemo(() => {
    const map = new Map<string, Usage[]>()
    for (const u of usages) {
      const list = map.get(u.usage_date) ?? []
      list.push(u)
      map.set(u.usage_date, list)
    }
    return map
  }, [usages])

  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function goMonth(delta: number) {
    setSelectedDate(null)
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setMonth(m)
    setYear(y)
  }

  const selectedUsages = selectedDate ? (byDate.get(selectedDate) ?? []) : []
  const monthTotal = cells
    .filter((d): d is number => d !== null)
    .reduce((sum, d) => sum + (byDate.get(toDateKey(year, month, d)) ?? []).reduce((s, u) => s + u.amount, 0), 0)

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="홈으로 가기">
          ←
        </Link>
        <h1 className="text-sm font-black text-foreground">달력</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col gap-4 max-w-sm mx-auto w-full">
        <div className="flex items-center justify-between">
          <button
            onClick={() => goMonth(-1)}
            aria-label="이전 달"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xl text-muted-foreground"
          >
            ‹
          </button>
          <span className="font-bold">{year}년 {month + 1}월</span>
          <button
            onClick={() => goMonth(1)}
            aria-label="다음 달"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xl text-muted-foreground"
          >
            ›
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">이번 달에 쓴 돈: {won(monthTotal)}</p>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-xs font-bold text-muted-foreground py-1">{w}</span>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <span key={`blank-${i}`} />
            const key = toDateKey(year, month, day)
            const dayUsages = byDate.get(key) ?? []
            const hasSpending = dayUsages.length > 0
            const isSelected = selectedDate === key
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(isSelected ? null : key)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors ${
                  isSelected ? 'bg-hero text-hero-foreground' : hasSpending ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span className="text-xs font-bold">{day}</span>
                {hasSpending && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-hero-foreground' : 'bg-foreground'}`} aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-muted-foreground">
            {selectedDate ? `${selectedDate} 에 쓴 돈` : '날짜를 눌러보세요'}
          </h2>
          {selectedDate && selectedUsages.length === 0 && (
            <p className="text-muted-foreground text-sm leading-relaxed">이 날은 쓴 돈이 없어요.</p>
          )}
          {selectedUsages.map((u) => (
            <div key={u.id} className="p-4 rounded-2xl bg-card ring-1 ring-border flex items-center justify-between">
              <span className="font-bold leading-relaxed">{u.description ?? '활동'}</span>
              <span className="font-bold">{won(u.amount)}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
