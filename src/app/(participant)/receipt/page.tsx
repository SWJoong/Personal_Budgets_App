import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import ReceiptClient from './ReceiptClient'

export default async function ReceiptPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const participant = await getCurrentParticipant()

  if (!participant) {
    return (
      <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
        <header className="flex h-14 items-center px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
          <h1 className="text-sm font-black text-zinc-800">지출 기록하기</h1>
        </header>
        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
          <span className="text-6xl">📸</span>
          <p className="text-zinc-500 font-medium leading-relaxed">아직 예산 정보가 없어요.<br />담당 선생님에게 말씀해 주세요.</p>
        </main>
      </div>
    )
  }

  const { data: allocation } = await supabase
    .from('seoul_budget_allocations')
    .select('id')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let requestedServices: { id: string; service_name: string }[] = []
  let usages: { id: string; usage_date: string; amount: number; description: string | null; settlement_status: string }[] = []

  if (allocation) {
    const [{ data: plan }, { data: usageRows }] = await Promise.all([
      supabase.from('seoul_utilization_plans').select('id').eq('participant_id', participant.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('seoul_service_usages').select('id, usage_date, amount, description, settlement_status').eq('allocation_id', allocation.id).order('usage_date', { ascending: false }).limit(20),
    ])
    usages = usageRows ?? []
    if (plan) {
      const { data: rs } = await supabase.from('seoul_requested_services').select('id, service_name').eq('plan_id', plan.id).eq('approved_for_service', true)
      requestedServices = rs ?? []
    }
  }

  return (
    <ReceiptClient
      participantId={participant.id}
      allocationId={allocation?.id ?? null}
      requestedServices={requestedServices}
      usages={usages}
    />
  )
}
