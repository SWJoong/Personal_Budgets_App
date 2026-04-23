'use client'

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/utils/budget-visuals'
import { EasyTerm } from '@/components/ui/EasyTerm'
import BillSvg from './BillIllustration'

interface Props {
  displayBalance: number
  pendingDeduction: number
  totalBudget: number
}

type Denom = {
  value: number
  label: string
  unit: '장' | '개'
  kind: 'bill' | 'coin'
  bg: string
  ring: string
  text: string
  border: string
}

const DENOMS: Denom[] = [
  { value: 50000, label: '5만원', unit: '장', kind: 'bill', bg: 'bg-yellow-100', ring: 'ring-yellow-400',  text: 'text-yellow-900', border: 'border-yellow-300' },
  { value: 10000, label: '1만원', unit: '장', kind: 'bill', bg: 'bg-green-100',  ring: 'ring-green-500',   text: 'text-green-900',  border: 'border-green-300' },
  { value: 5000,  label: '5천원', unit: '장', kind: 'bill', bg: 'bg-orange-100', ring: 'ring-orange-400',  text: 'text-orange-900', border: 'border-orange-300' },
  { value: 1000,  label: '1천원', unit: '장', kind: 'bill', bg: 'bg-blue-100',   ring: 'ring-blue-400',    text: 'text-blue-900',   border: 'border-blue-300' },
  { value: 500,   label: '500원', unit: '개', kind: 'coin', bg: 'bg-zinc-200',   ring: 'ring-zinc-400',    text: 'text-zinc-800',   border: 'border-zinc-300' },
  { value: 100,   label: '100원', unit: '개', kind: 'coin', bg: 'bg-amber-200',  ring: 'ring-amber-500',   text: 'text-amber-900',  border: 'border-amber-400' },
]

function decompose(amount: number) {
  let remain = Math.max(0, Math.floor(amount))
  return DENOMS.map(d => {
    const count = Math.floor(remain / d.value)
    remain -= count * d.value
    return { ...d, count }
  })
}

/* ── 지폐 스택 ── */
function BillStack({ d, pending, spent }: { d: Denom & { count: number }; pending?: boolean; spent?: boolean }) {
  if (d.count === 0) return null
  const visualCount = Math.min(d.count, 8)
  return (
    <div className="flex items-center gap-4 transition-all duration-500 ease-out">
      {/* 지폐 시각 영역 — 14px 간격으로 개별 장 식별 가능 */}
      <div className="relative w-28 shrink-0" style={{ height: `${40 + (visualCount - 1) * 14}px` }}>
        {Array.from({ length: visualCount }).map((_, i) => (
          <div
            key={i}
            className={`absolute h-10 rounded-lg ${d.bg} ring-1 ${d.ring} ${
              pending ? 'border-2 border-dashed border-zinc-400 ring-0' : 'shadow-sm'
            } flex items-center justify-center overflow-hidden`}
            style={{
              top: `${i * 14}px`,
              left: `${i * 3}px`,
              right: `${-i * 3}px`,
              zIndex: visualCount - i,
            }}
          >
            {i === 0 && (
              <div className="w-full h-full p-0.5">
                <BillSvg value={d.value} />
              </div>
            )}
            {/* spent: 맨 앞 카드에 빨간 X 오버레이 */}
            {spent && i === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 100 40" className="w-full h-full opacity-30">
                  <line x1="5" y1="2" x2="95" y2="38" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                  <line x1="95" y1="2" x2="5" y2="38" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`text-lg font-black ${spent ? 'text-zinc-400 line-through decoration-red-400 decoration-2' : 'text-zinc-800'}`}>
          {d.count}
          <span className="text-xs font-bold text-zinc-500 ml-0.5">{d.unit}</span>
        </span>
        <span className="text-[11px] font-medium text-zinc-400">
          {formatCurrency(d.value * d.count)}원
        </span>
      </div>
    </div>
  )
}

/* ── 동전 스택 ── */
function CoinStack({ d, pending, spent }: { d: Denom & { count: number }; pending?: boolean; spent?: boolean }) {
  if (d.count === 0) return null
  const visualCount = Math.min(d.count, 8)
  return (
    <div className="flex items-center gap-4 transition-all duration-500 ease-out">
      <div className="relative w-28 h-12 shrink-0 flex items-center">
        {Array.from({ length: visualCount }).map((_, i) => (
          <div
            key={i}
            className={`absolute w-10 h-10 rounded-full ${d.bg} ring-2 ${d.ring} ${
              pending ? 'border-2 border-dashed border-zinc-400 ring-0' : 'shadow-sm'
            } flex items-center justify-center overflow-hidden`}
            style={{
              left: `${i * 14}px`,
              zIndex: visualCount - i,
            }}
          >
            {i === 0 && (
              <span className={`text-[10px] font-black ${d.text} relative z-10`}>
                {d.value === 500 ? '500' : '100'}
              </span>
            )}
            {spent && i === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 40 40" className="w-full h-full opacity-30">
                  <line x1="4" y1="4" x2="36" y2="36" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                  <line x1="36" y1="4" x2="4" y2="36" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`text-lg font-black ${spent ? 'text-zinc-400 line-through decoration-red-400 decoration-2' : 'text-zinc-800'}`}>
          {d.count}
          <span className="text-xs font-bold text-zinc-500 ml-0.5">{d.unit}</span>
        </span>
        <span className="text-[11px] font-medium text-zinc-400">
          {formatCurrency(d.value * d.count)}원
        </span>
      </div>
    </div>
  )
}

/* ── "이미 쓴 돈" 접기/펼치기 섹션 ── */
function SpentSection({ spentAmount, visibleSpent }: { spentAmount: number; visibleSpent: (Denom & { count: number })[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-dashed border-red-200 pt-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between mb-2"
      >
        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">
          🧾 <EasyTerm formal="이번 달 사용액" easy="이미 쓴 돈" />
        </p>
        <div className="flex items-center gap-2">
          <p className="text-sm font-black text-red-500">
            -{formatCurrency(spentAmount)}원
          </p>
          <span className="text-[10px] text-zinc-400 font-bold">
            {open ? '▲ 접기' : '▼ 자세히'}
          </span>
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-4 opacity-[0.65] animate-fade-in-up">
          {visibleSpent.map(d =>
            d.kind === 'bill' ? (
              <BillStack key={d.value} d={d} spent />
            ) : (
              <CoinStack key={d.value} d={d} spent />
            )
          )}
        </div>
      )}
    </div>
  )
}

export default function CashViz({ displayBalance, pendingDeduction, totalBudget }: Props) {
  const balanceParts = useMemo(() => decompose(displayBalance), [displayBalance])
  const pendingParts = useMemo(() => decompose(pendingDeduction), [pendingDeduction])

  const spentAmount = Math.max(0, totalBudget - displayBalance - pendingDeduction)
  const spentParts = useMemo(() => decompose(spentAmount), [spentAmount])

  const hasPending = pendingDeduction > 0
  const hasSpent = spentAmount > 0

  const visibleBalance = balanceParts.filter(p => p.count > 0)
  const visiblePending = pendingParts.filter(p => p.count > 0)
  const visibleSpent = spentParts.filter(p => p.count > 0)

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      {/* ━━ 남은 돈 ━━ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            💰 <EasyTerm formal="현재 잔액" easy="지금 남은 돈" />
          </p>
          <p className="text-sm font-black text-zinc-700">
            {formatCurrency(displayBalance)}원
          </p>
        </div>
        {visibleBalance.length === 0 ? (
          <p className="text-sm font-bold text-zinc-400 py-4 text-center">
            남은 돈이 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleBalance.map(d =>
              d.kind === 'bill' ? (
                <BillStack key={d.value} d={d} />
              ) : (
                <CoinStack key={d.value} d={d} />
              )
            )}
          </div>
        )}
      </div>

      {/* ━━ 반영 대기 중 (점선) ━━ */}
      {hasPending && visiblePending.length > 0 && (
        <div className="border-t border-dashed border-orange-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
              🕒 <EasyTerm formal="반영 대기 중" easy="곧 빠져 나갈 돈" />
            </p>
            <p className="text-sm font-black text-orange-500">
              -{formatCurrency(pendingDeduction)}원
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {visiblePending.map(d =>
              d.kind === 'bill' ? (
                <BillStack key={d.value} d={d} pending />
              ) : (
                <CoinStack key={d.value} d={d} pending />
              )
            )}
          </div>
        </div>
      )}

      {/* ━━ 이미 사용한 돈 (기본 접기) ━━ */}
      {hasSpent && visibleSpent.length > 0 && (
        <SpentSection spentAmount={spentAmount} visibleSpent={visibleSpent} />
      )}

      {/* ━━ 요약 바 ━━ */}
      {totalBudget > 0 && (
        <div className="border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-2 text-xs font-bold">
            <div className="flex items-center gap-1.5 flex-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
              <span className="text-zinc-500">남은 돈 {formatCurrency(displayBalance)}</span>
            </div>
            {hasPending && (
              <div className="flex items-center gap-1.5 flex-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-orange-400 border border-dashed border-orange-500" />
                <span className="text-zinc-500">대기 {formatCurrency(pendingDeduction)}</span>
              </div>
            )}
            {hasSpent && (
              <div className="flex items-center gap-1.5 flex-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-300" />
                <span className="text-zinc-500">사용 {formatCurrency(spentAmount)}</span>
              </div>
            )}
          </div>
          <div className="h-2 rounded-full bg-zinc-100 mt-2 overflow-hidden flex">
            <div
              className="h-full bg-green-400 transition-all duration-700"
              style={{ width: `${Math.round((displayBalance / totalBudget) * 100)}%` }}
            />
            {hasPending && (
              <div
                className="h-full bg-orange-400/60 transition-all duration-700"
                style={{ width: `${Math.round((pendingDeduction / totalBudget) * 100)}%` }}
              />
            )}
            <div
              className="h-full bg-red-300 transition-all duration-700"
              style={{ width: `${Math.round((spentAmount / totalBudget) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
