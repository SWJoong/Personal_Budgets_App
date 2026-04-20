'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'
import type { MonthlyPlanProgress } from '@/app/actions/monthlyPlan'
import { EasyTerm } from '@/components/ui/EasyTerm'

interface Props {
  participantId: string
  month: string                         // 'YYYY-MM-01'
  plans: MonthlyPlanProgress[]
  isStaff?: boolean                     // 실무자/관리자면 편집 링크로 이동
}

function percent(spent: number, budget: number): number {
  if (!budget || budget <= 0) return 0
  return Math.min(100, Math.round((spent / budget) * 100))
}

export default function MonthlyPlanMiniProgress({
  participantId,
  month,
  plans,
  isStaff = false,
}: Props) {
  const [open, setOpen] = useState(true)

  if (!plans || plans.length === 0) return null

  const editPath = isStaff
    ? `/supporter/evaluations/${participantId}/${month.slice(0, 7)}/plans`
    : `/plan`

  return (
    <div className="border-t border-zinc-100 mx-5">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">
          📋 <EasyTerm formal="이번 달 계획 진행" easy="이번 달에 내가 세운 계획" />
        </span>
        <span className="text-[10px] font-bold text-zinc-400">
          {open ? '▲ 접기' : '▼ 펼치기'}
        </span>
      </button>

      {open && (
        <div className="pb-5 flex flex-col gap-3">
          {plans.map(p => {
            const pct = percent(p.spent_confirmed, Number(p.planned_budget) || 0)
            const remaining =
              p.target_count != null ? Math.max(0, p.target_count - p.tx_count) : null
            return (
              <div key={p.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-zinc-800 truncate">
                    {p.order_index}. {p.title}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-500 whitespace-nowrap">
                    {formatCurrency(p.spent_confirmed)} / {formatCurrency(Number(p.planned_budget) || 0)}원
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className={`h-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                  <span>진행률 {pct}%</span>
                  {remaining !== null && (
                    <span>
                      목표 {p.target_count}회 · 남은 횟수 {remaining}회
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          <Link
            href={editPath}
            className="text-[11px] font-bold text-zinc-900 underline underline-offset-2 text-center mt-1"
          >
            {isStaff ? '계획 편집하기' : '내 계획 전체보기'}
          </Link>
        </div>
      )}
    </div>
  )
}
