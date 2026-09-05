import Link from 'next/link'
import { requireStaff } from '@/utils/supabase/staff'
import { getUtilizationPlans } from '@/app/actions/utilizationPlan'
import { EmptyState } from '@/components/ui/EmptyState'

const STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  submitted: '제출됨 — 심의 대기',
  under_review: '심의 중',
  approved: '승인됨',
  conditional: '조건부 승인',
  rejected: '반려됨',
  under_appeal: '이의신청 중',
}

export const metadata = { title: '이용계획' }

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
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">이용계획 · 심의</h1>
        <Link
          href="/supporter/plans/new"
          className="px-4 py-2 rounded-xl bg-hero text-hero-foreground text-sm font-bold hover:bg-hero-hover transition-colors min-h-[44px] flex items-center"
        >
          새 계획 만들기
        </Link>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-3">
        {error && (
          <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm">{error}</div>
        )}

        {(plans ?? []).length === 0 ? (
          <EmptyState title="아직 작성된 이용계획이 없어요." action={{ label: '새 계획 만들기', href: '/supporter/plans/new' }} />
        ) : (
          <ul className="flex flex-col gap-2">
            {(plans ?? []).map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/supporter/plans/${plan.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-card ring-1 ring-border hover:ring-foreground transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-bold">{participantName.get(plan.participant_id) ?? '이름 없음'}</span>
                    <span className="text-xs text-muted-foreground">
                      {plan.plan_period_start ?? '—'} ~ {plan.plan_period_end ?? '—'}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
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
