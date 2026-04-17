'use client'

import { useState, useRef, useEffect } from 'react'
import { EasyTerm } from '@/components/ui/EasyTerm'

interface TxItem {
  id: string
  activity_name: string
  amount: number
  date: string
  category?: string | null
}

interface MonthlyData {
  month: string
  totalSpent: number
  budget: number
  transactions?: TxItem[]
}

interface Props {
  monthlyData: MonthlyData[]
}

// 거래 세그먼트 색상 팔레트 (파란 계열 → 인디고 계열 반복)
const SEG_COLORS = [
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#0ea5e9', // sky-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#818cf8', // indigo-400
  '#38bdf8', // sky-400
  '#a78bfa', // violet-400
]
const SEG_COLORS_OVER = [
  '#ef4444', '#dc2626', '#f87171', '#b91c1c', '#fca5a5', '#991b1b', '#fee2e2', '#7f1d1d',
]

export default function BudgetTrendChart({ monthlyData }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 외부 터치 시 툴팁 닫기
  useEffect(() => {
    if (activeIdx === null) return
    function handleOutside(e: TouchEvent | MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveIdx(null)
      }
    }
    document.addEventListener('touchstart', handleOutside, { passive: true })
    document.addEventListener('mousedown', handleOutside)
    return () => {
      document.removeEventListener('touchstart', handleOutside)
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [activeIdx])

  if (monthlyData.length === 0) return null

  const maxAmount = Math.max(...monthlyData.map(d => Math.max(d.totalSpent, d.budget)), 1)
  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">
        <EasyTerm formal="월별 지출 추이" easy="달마다 쓴 돈" />
      </h3>
      <div className="bg-white rounded-[2rem] p-5 ring-1 ring-zinc-200 shadow-sm">
        {/* 범례 */}
        <div className="flex items-center gap-4 mb-4 text-[11px] font-bold text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-blue-500" />
            <EasyTerm formal="지출" easy="쓴 돈" />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[3px] border-2 border-dashed border-zinc-400 bg-transparent" />
            <EasyTerm formal="예산 기준" easy="쓸 수 있는 돈" />
          </span>
          <span className="flex items-center gap-1.5 ml-auto text-[10px] text-zinc-400 font-medium">
            터치하면 세부 내역
          </span>
        </div>

        {/* 바 차트 영역 */}
        <div
          ref={containerRef}
          className="relative flex items-end gap-1.5 h-28"
        >
          {monthlyData.map((d, i) => {
            const isCurrentMonth = d.month === currentMonth
            const isOverBudget = d.budget > 0 && d.totalSpent > d.budget
            const barPct = d.totalSpent > 0 ? Math.max((d.totalSpent / maxAmount) * 100, 3) : 0
            const budgetPct = d.budget > 0 ? (d.budget / maxAmount) * 100 : 0
            const txs = d.transactions ?? []
            const isActive = activeIdx === i
            // 툴팁을 오른쪽으로 넘길지 왼쪽으로 넘길지 결정 (끝 2개는 왼쪽)
            const tooltipRight = i >= monthlyData.length - 2

            return (
              <div
                key={d.month}
                className="relative flex-1 h-full flex flex-col justify-end select-none"
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                onTouchStart={() => setActiveIdx(prev => prev === i ? null : i)}
              >
                {/* 예산 기준선 */}
                {budgetPct > 0 && (
                  <div
                    className="absolute left-0 right-0 border-t-[1.5px] border-dashed border-zinc-400 pointer-events-none z-10"
                    style={{ bottom: `${budgetPct}%` }}
                  />
                )}

                {/* 막대 + 세그먼트 */}
                {barPct > 0 ? (
                  <div
                    className="relative w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-all duration-500"
                    style={{ height: `${barPct}%` }}
                  >
                    {txs.length > 0 ? (
                      // 스택형 세그먼트 (flex-col-reverse → 최초 거래가 아래)
                      txs.map((tx, ti) => {
                        const segPct = (tx.amount / d.totalSpent) * 100
                        const palette = isOverBudget ? SEG_COLORS_OVER : SEG_COLORS
                        const baseColor = palette[ti % palette.length]
                        return (
                          <div
                            key={tx.id}
                            style={{
                              flexBasis: `${segPct}%`,
                              flexShrink: 0,
                              flexGrow: 0,
                              backgroundColor: isActive
                                ? baseColor
                                : isOverBudget
                                  ? '#ef4444'
                                  : isCurrentMonth ? '#3b82f6' : '#93c5fd',
                              opacity: isCurrentMonth || isActive ? 1 : 0.8,
                              transition: 'background-color 0.2s',
                            }}
                          />
                        )
                      })
                    ) : (
                      // 거래 데이터 없을 때 단색
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundColor: isOverBudget
                            ? '#ef4444'
                            : isCurrentMonth ? '#3b82f6' : '#93c5fd',
                          opacity: isCurrentMonth ? 1 : 0.8,
                        }}
                      />
                    )}
                  </div>
                ) : (
                  // 0원 월 — 최소 선 표시
                  <div className="w-full h-0.5 rounded bg-zinc-100" />
                )}

                {/* 상단 금액 라벨 */}
                {d.totalSpent > 0 && (
                  <div
                    className="absolute left-0 right-0 text-center pointer-events-none"
                    style={{ bottom: `${barPct}%`, marginBottom: 3 }}
                  >
                    <span className={`text-[9px] font-black leading-none ${
                      isOverBudget ? 'text-red-600' : isCurrentMonth ? 'text-blue-600' : 'text-zinc-400'
                    }`}>
                      {d.totalSpent >= 10000
                        ? `${Math.round(d.totalSpent / 10000)}만`
                        : d.totalSpent.toLocaleString()
                      }
                    </span>
                  </div>
                )}

                {/* 툴팁 */}
                {isActive && (
                  <div
                    className={`absolute bottom-full mb-2 z-50 w-44 bg-zinc-900 text-white rounded-xl p-3 shadow-2xl pointer-events-none ${
                      tooltipRight ? 'right-0' : 'left-0'
                    }`}
                    style={{ minWidth: 160 }}
                  >
                    {/* 화살표 */}
                    <div className={`absolute top-full ${tooltipRight ? 'right-3' : 'left-3'} w-0 h-0`}
                      style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #18181b' }}
                    />
                    <p className="text-[10px] font-black text-zinc-400 mb-2">
                      {Number(d.month.split('-')[1])}월 · {txs.length > 0 ? `${txs.length}건` : '내역 없음'}
                    </p>
                    {txs.length > 0 ? (
                      <>
                        <div className="flex flex-col gap-1.5">
                          {txs.map((tx, ti) => (
                            <div key={tx.id} className="flex items-center gap-1.5">
                              <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: SEG_COLORS[ti % SEG_COLORS.length] }}
                              />
                              <span className="text-[11px] truncate flex-1 text-zinc-200">{tx.activity_name}</span>
                              <span className="text-[10px] font-black shrink-0 text-white">
                                {tx.amount >= 10000
                                  ? `${(tx.amount / 10000).toFixed(1)}만`
                                  : `${tx.amount.toLocaleString()}`
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-zinc-700 mt-2 pt-2 flex justify-between items-center">
                          <span className="text-[10px] text-zinc-400">합계</span>
                          <span className={`text-[11px] font-black ${isOverBudget ? 'text-red-400' : 'text-white'}`}>
                            {d.totalSpent >= 10000
                              ? `${(d.totalSpent / 10000).toFixed(1)}만원`
                              : `${d.totalSpent.toLocaleString()}원`
                            }
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-zinc-400">이번 달 지출 없음</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 월 라벨 */}
        <div className="flex gap-1.5 mt-2">
          {monthlyData.map((d) => {
            const monthNum = Number(d.month.split('-')[1])
            const isCurrentMonth = d.month === currentMonth
            return (
              <div key={d.month} className="flex-1 text-center">
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
