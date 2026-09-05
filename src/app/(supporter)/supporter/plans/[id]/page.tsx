import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import { getReviewCommittees } from '@/app/actions/planReview'
import PlanDetailClient from './PlanDetailClient'

export const metadata = { title: '계획 상세' }

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profile } = await requireStaff()

  const { data: plan } = await supabase
    .from('seoul_utilization_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!plan) notFound()

  const [{ data: participant }, { data: narrative }, { data: requestedServices }, { data: reviews }] = await Promise.all([
    supabase.from('participants').select('id, name').eq('id', plan.participant_id).maybeSingle(),
    supabase.from('seoul_self_narratives').select('*').eq('plan_id', id).maybeSingle(),
    supabase.from('seoul_requested_services').select('*').eq('plan_id', id).order('priority'),
    supabase.from('seoul_plan_reviews').select('*').eq('plan_id', id).order('review_date', { ascending: false }).limit(1),
  ])

  const latestReview = reviews?.[0] ?? null
  const { data: notification } = latestReview
    ? await supabase.from('seoul_notifications').select('*').eq('review_id', latestReview.id).maybeSingle()
    : { data: null }

  // 심의 주체는 심사처가 전달한 구성을 기록해 둔 목록이다 — 앱이 유효성을 판단하지 않는다.
  const { committees } = await getReviewCommittees()

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link href="/supporter/plans" aria-label="뒤로 가기" className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
        <h1 className="text-xl font-bold tracking-tight">{participant?.name ?? '당사자'}님의 이용계획</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <PlanDetailClient
          planId={id}
          participantId={plan.participant_id}
          status={plan.status}
          isAdmin={profile.role === 'admin'}
          narrative={narrative ?? null}
          requestedServices={requestedServices ?? []}
          latestReview={latestReview}
          notification={notification}
          committees={committees}
        />
      </main>
    </div>
  )
}
