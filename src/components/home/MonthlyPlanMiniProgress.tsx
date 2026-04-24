'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'
import type { MonthlyPlanProgress } from '@/app/actions/monthlyPlan'
import { EasyTerm } from '@/components/ui/EasyTerm'
import MonthlyPlanEasyCard from '@/components/plans/MonthlyPlanEasyCard'

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
  const [open, setOpen] = useState(false)

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
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none px-1">
            {plans.map(p => (
              <div key={p.id} className="snap-start shrink-0">
                <MonthlyPlanEasyCard
                  id={p.id}
                  orderIndex={p.order_index}
                  title={p.title}
                  easyDescription={p.easy_description}
                  easyImageUrl={p.easy_image_url}
                  targetCount={p.target_count}
                  txCount={p.tx_count}
                  plannedBudget={Number(p.planned_budget) || 0}
                  spentConfirmed={p.spent_confirmed || 0}
                  spentPending={p.spent_pending || 0}
                />
              </div>
            ))}
          </div>
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
