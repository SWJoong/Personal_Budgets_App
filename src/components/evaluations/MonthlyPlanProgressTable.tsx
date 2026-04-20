import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'
import type { MonthlyPlanProgress } from '@/app/actions/monthlyPlan'

interface Props {
  participantId: string
  month: string                         // 'YYYY-MM-01' 또는 'YYYY-MM'
  plans: MonthlyPlanProgress[]
  editable?: boolean                    // 실무자/관리자 편집 링크 노출 여부
}

function percent(spent: number, budget: number): number {
  if (!budget || budget <= 0) return 0
  return Math.min(100, Math.round((spent / budget) * 100))
}

export default function MonthlyPlanProgressTable({
  participantId,
  month,
  plans,
  editable = false,
}: Props) {
  const monthForLink = month.slice(0, 7)

  if (plans.length === 0) {
    return (
      <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">월별 계획 진행률</h3>
          {editable && (
            <Link
              href={`/supporter/evaluations/${participantId}/${monthForLink}/plans`}
              className="text-xs font-bold text-zinc-900 underline underline-offset-2"
            >
              계획 편집
            </Link>
          )}
        </div>
        <p className="text-sm text-zinc-400 py-8 text-center">
          아직 등록된 월별 계획이 없어요.
        </p>
      </section>
    )
  }

  const totals = plans.reduce(
    (acc, p) => {
      acc.budget += Number(p.planned_budget) || 0
      acc.confirmed += p.spent_confirmed
      acc.pending += p.spent_pending
      acc.count += p.tx_count
      return acc
    },
    { budget: 0, confirmed: 0, pending: 0, count: 0 }
  )

  return (
    <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm print:shadow-none print:ring-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">월별 계획 진행률</h3>
        {editable && (
          <Link
            href={`/supporter/evaluations/${participantId}/${monthForLink}/plans`}
            className="text-xs font-bold text-zinc-900 underline underline-offset-2 print:hidden"
          >
            계획 편집
          </Link>
        )}
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-200">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">계획</th>
              <th className="py-2 pr-3">재원</th>
              <th className="py-2 pr-3 text-right">예산</th>
              <th className="py-2 pr-3 text-right">사용</th>
              <th className="py-2 pr-3 text-right">대기</th>
              <th className="py-2 pr-3 text-right">진행률</th>
              <th className="py-2 pr-3 text-right">목표/실제</th>
              <th className="py-2 text-right">거래</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(p => {
              const pct = percent(p.spent_confirmed, Number(p.planned_budget) || 0)
              const remainingCount =
                p.target_count != null ? Math.max(0, p.target_count - p.tx_count) : null
              return (
                <tr key={p.id} className="border-b border-zinc-100 align-top">
                  <td className="py-3 pr-3 font-bold text-zinc-500">{p.order_index}</td>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-zinc-900">{p.title}</p>
                    {p.description && (
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-xs text-zinc-600">
                    {p.funding_source?.name ?? '—'}
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-zinc-800 whitespace-nowrap">
                    {formatCurrency(Number(p.planned_budget) || 0)}원
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-zinc-900 whitespace-nowrap">
                    {formatCurrency(p.spent_confirmed)}원
                  </td>
                  <td className="py-3 pr-3 text-right font-medium text-orange-600 whitespace-nowrap">
                    {p.spent_pending > 0 ? `${formatCurrency(p.spent_pending)}원` : '—'}
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-20 h-2 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={`h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-bold text-zinc-800 text-xs">{pct}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right text-xs text-zinc-600 whitespace-nowrap">
                    {p.target_count != null
                      ? `${p.tx_count}/${p.target_count} (남음 ${remainingCount})`
                      : '—'}
                  </td>
                  <td className="py-3 text-right text-xs text-zinc-600 font-bold">
                    {p.tx_count}건
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-black text-zinc-900 border-t-2 border-zinc-300">
              <td className="py-3 pr-3" colSpan={3}>합계</td>
              <td className="py-3 pr-3 text-right whitespace-nowrap">{formatCurrency(totals.budget)}원</td>
              <td className="py-3 pr-3 text-right whitespace-nowrap">{formatCurrency(totals.confirmed)}원</td>
              <td className="py-3 pr-3 text-right whitespace-nowrap text-orange-600">
                {totals.pending > 0 ? `${formatCurrency(totals.pending)}원` : '—'}
              </td>
              <td className="py-3 pr-3 text-right">
                {percent(totals.confirmed, totals.budget)}%
              </td>
              <td className="py-3 pr-3"></td>
              <td className="py-3 text-right">{totals.count}건</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
