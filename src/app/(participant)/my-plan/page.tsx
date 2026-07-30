import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import MyPlanClient from './MyPlanClient'

export default async function MyPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const participant = await getCurrentParticipant()

  if (!participant) {
    return (
      <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
        <header className="flex h-14 items-center px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
          <h1 className="text-sm font-black text-zinc-800">내 이용계획</h1>
        </header>
        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
          <span className="text-6xl">🎯</span>
          <p className="text-zinc-500 font-medium leading-relaxed">아직 예산 정보가 없어요.<br />담당 선생님에게 말씀해 주세요.</p>
        </main>
      </div>
    )
  }

  const { data: plan } = await supabase
    .from('seoul_utilization_plans')
    .select('*')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let selectedApplicationId: string | null = null
  if (!plan) {
    const { data: application } = await supabase
      .from('seoul_applications')
      .select('id')
      .eq('participant_id', participant.id)
      .eq('status', 'selected')
      .order('application_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    selectedApplicationId = application?.id ?? null
  }

  let narrative = null
  let requestedServices: { id: string; priority: number; service_name: string; estimated_cost: number | null }[] = []
  let latestReview: { id: string; decision: string; reason: string | null } | null = null
  let notification: { id: string; is_read_by_participant: boolean } | null = null

  if (plan) {
    const [{ data: n }, { data: rs }, { data: reviews }] = await Promise.all([
      supabase.from('seoul_self_narratives').select('*').eq('plan_id', plan.id).maybeSingle(),
      supabase.from('seoul_requested_services').select('id, priority, service_name, estimated_cost').eq('plan_id', plan.id).order('priority'),
      supabase.from('seoul_plan_reviews').select('id, decision, reason').eq('plan_id', plan.id).order('review_date', { ascending: false }).limit(1),
    ])
    narrative = n ?? null
    requestedServices = rs ?? []
    latestReview = reviews?.[0] ?? null

    if (latestReview) {
      const { data: notif } = await supabase
        .from('seoul_notifications')
        .select('id, is_read_by_participant')
        .eq('review_id', latestReview.id)
        .maybeSingle()
      notification = notif ?? null
    }
  }

  return (
    <MyPlanClient
      participantId={participant.id}
      selectedApplicationId={selectedApplicationId}
      plan={plan ?? null}
      narrative={narrative}
      requestedServices={requestedServices}
      latestReview={latestReview}
      notification={notification}
    />
  )
}
