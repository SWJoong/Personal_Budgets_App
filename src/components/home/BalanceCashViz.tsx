'use client'

import { useMemo } from 'react'
import { formatCurrency } from '@/utils/budget-visuals'
import { EasyTerm } from '@/components/ui/EasyTerm'

interface Props {
  displayBalance: number
  pendingDeduction: number
}

type Denom = {
  value: number
  label: string
  unit: '장' | '개'
  kind: 'bill' | 'coin'
  bg: string
  ring: string
  text: string
}

const DENOMS: Denom[] = [
  { value: 50000, label: '5만원', unit: '장', kind: 'bill', bg: 'bg-yellow-100', ring: 'ring-yellow-400',  text: 'text-yellow-900' },
  { value: 10000, label: '1만원', unit: '장', kind: 'bill', bg: 'bg-green-100',  ring: 'ring-green-500',   text: 'text-green-900'  },
  { value: 5000,  label: '5천원', unit: '장', kind: 'bill', bg: 'bg-orange-100', ring: 'ring-orange-400',  text: 'text-orange-900' },
  { value: 1000,  label: '1천원', unit: '장', kind: 'bill', bg: 'bg-blue-100',   ring: 'ring-blue-400',    text: 'text-blue-900'   },
  { value: 500,   label: '500원', unit: '개', kind: 'coin', bg: 'bg-zinc-200',   ring: 'ring-zinc-400',    text: 'text-zinc-800'   },
  { value: 100,   label: '100원', unit: '개', kind: 'coin', bg: 'bg-amber-200',  ring: 'ring-amber-500',   text: 'text-amber-900'  },
]

function decompose(amount: number) {
  let remain = Math.max(0, Math.floor(amount))
  return DENOMS.map(d => {
    const count = Math.floor(remain / d.value)
    remain -= count * d.value
    return { ...d, count }
  })
}

function BillStack({ d, pending }: { d: Denom & { count: number }; pending?: boolean }) {
  if (d.count === 0) return null
  const visualCount = Math.min(d.count, 5)
  return (
    <div
      className={`flex items-center gap-3 transition-all duration-500 ease-out ${
        pending ? 'opacity-60' : 'opacity-100'
      }`}
    >
      <div className="relative w-24 h-12 shrink-0">
        {Array.from({ length: visualCount }).map((_, i) => (
          <div
            key={i}
            className={`absolute left-0 right-0 h-10 rounded-md ${d.bg} ring-1 ${d.ring} ${
              pending ? 'border-2 border-dashed border-zinc-400 ring-0' : 'shadow-sm'
            } flex items-center justify-center`}
            style={{
              top: `${i * 3}px`,
              left: `${i * 2}px`,
              right: `${-i * 2}px`,
              zIndex: visualCount - i,
            }}
          >
            {i === 0 && (
              <span className={`text-[11px] font-black ${d.text} tracking-tight`}>
                {d.label}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-base font-black text-zinc-800">
          × {d.count}
          <span className="text-xs font-bold text-zinc-500 ml-1">{d.unit}</span>
        </span>
        <span className="text-[10px] font-medium text-zinc-400">
          {formatCurrency(d.value * d.count)}원
        </span>
      </div>
    </div>
  )
}

function CoinStack({ d, pending }: { d: Denom & { count: number }; pending?: boolean }) {
  if (d.count === 0) return null
  const visualCount = Math.min(d.count, 5)
  return (
    <div
      className={`flex items-center gap-3 transition-all duration-500 ease-out ${
        pending ? 'opacity-60' : 'opacity-100'
      }`}
    >
      <div className="relative w-24 h-12 shrink-0 flex items-center">
        {Array.from({ length: visualCount }).map((_, i) => (
          <div
            key={i}
            className={`absolute w-10 h-10 rounded-full ${d.bg} ring-2 ${d.ring} ${
              pending ? 'border-2 border-dashed border-zinc-400 ring-0' : 'shadow-sm'
            } flex items-center justify-center`}
            style={{
              left: `${i * 14}px`,
              zIndex: visualCount - i,
            }}
          >
            {i === 0 && (
              <span className={`text-[10px] font-black ${d.text}`}>
                {d.value === 500 ? '500' : '100'}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-base font-black text-zinc-800">
          × {d.count}
          <span className="text-xs font-bold text-zinc-500 ml-1">{d.unit}</span>
        </span>
        <span className="text-[10px] font-medium text-zinc-400">
          {formatCurrency(d.value * d.count)}원
        </span>
      </div>
    </div>
  )
}

export default function CashViz({ displayBalance, pendingDeduction }: Props) {
  const balanceParts = useMemo(() => decompose(displayBalance), [displayBalance])
  const pendingParts = useMemo(() => decompose(pendingDeduction), [pendingDeduction])

  const hasPending = pendingDeduction > 0
  const visibleBalance = balanceParts.filter(p => p.count > 0)
  const visiblePending = pendingParts.filter(p => p.count > 0)

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <div>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
          <EasyTerm formal="현재 잔액" easy="지금 남은 돈" />
        </p>
        {visibleBalance.length === 0 ? (
          <p className="text-sm font-bold text-zinc-400 py-4 text-center">
            남은 돈이 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
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

      {hasPending && visiblePending.length > 0 && (
        <div className="border-t border-dashed border-zinc-200 pt-3">
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2">
            🕒 <EasyTerm formal="반영 대기 중" easy="곧 빠져 나갈 돈" /> ({formatCurrency(pendingDeduction)}원)
          </p>
          <div className="flex flex-col gap-2.5">
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
    </div>
  )
}
