import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { getUtilizationPlans } from '@/app/actions/utilizationPlan'

const STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  submitted: '제출됨 — 심의 대기',
  under_review: '심의 중',
  approved: '승인됨',
  conditional: '조건부 승인',
  rejected: '반려됨',
  under_appeal: '이의신청 중',
}

export default async function PlansPage() {
  const { supabase } = await requireStaff()
  const { plans, error } = await getUtilizationPlans()

  const participantIds = [...new Set((plans ?? []).map((p) => p.participant_id))]
  const { data: participants } = participantIds.length
    ? await supabase.from('participants').select('id, name').in('id', participantIds)
    : { data: [] as { id: string; name: string }[] }
  const participantName = new Map((participants ?? []).map((p) => [p.id, p.name]))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">이용계획 · 심의</h1>
        <Link
          href="/supporter/plans/new"
          className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors min-h-[44px] flex items-center"
        >
          새 계획 만들기
        </Link>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
        )}

        {(plans ?? []).length === 0 ? (
          <p className="text-zinc-400 text-sm py-8 text-center">아직 작성된 이용계획이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(plans ?? []).map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/supporter/plans/${plan.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-bold">{participantName.get(plan.participant_id) ?? '이름 없음'}</span>
                    <span className="text-xs text-zinc-400">
                      {plan.plan_period_start ?? '—'} ~ {plan.plan_period_end ?? '—'}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600">
                    {STATUS_LABEL[plan.status] ?? plan.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
