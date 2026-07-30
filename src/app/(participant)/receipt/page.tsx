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
    .select('id, plan_id')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let requestedServices: { id: string; service_name: string }[] = []
  let usages: { id: string; usage_date: string; amount: number; description: string | null; settlement_status: string }[] = []
  let remaining: number | null = null

  if (allocation) {
    // requestedServices 는 이 배정이 실제로 속한 계획(allocation.plan_id) 기준으로 가져온다 —
    // 참여자 이름으로 "가장 최근 계획"을 다시 찾으면 여러 차수를 거친 경우 배정과 다른
    // 계획의 항목이 섞여 나올 수 있다.
    const [{ data: rs }, { data: usageRows }, { data: balance }] = await Promise.all([
      supabase.from('seoul_requested_services').select('id, service_name').eq('plan_id', allocation.plan_id).eq('approved_for_service', true),
      supabase.from('seoul_service_usages').select('id, usage_date, amount, description, settlement_status').eq('allocation_id', allocation.id).order('usage_date', { ascending: false }).limit(20),
      supabase.from('v_seoul_budget_balance').select('remaining').eq('allocation_id', allocation.id).maybeSingle(),
    ])
    requestedServices = rs ?? []
    usages = usageRows ?? []
    remaining = balance ? Number(balance.remaining) : null
  }

  return (
    <ReceiptClient
      participantId={participant.id}
      allocationId={allocation?.id ?? null}
      requestedServices={requestedServices}
      usages={usages}
      remaining={remaining}
    />
  )
}
