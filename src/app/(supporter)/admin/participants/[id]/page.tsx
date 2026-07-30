import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/utils/supabase/staff'
import { getMonitoringRecords } from '@/app/actions/monitoring'
import { getSettlements } from '@/app/actions/settlement'
import { getAppeals } from '@/app/actions/appeal'
import ParticipantDetailClient from './ParticipantDetailClient'

export default async function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name, email, auth_user_id')
    .eq('id', id)
    .maybeSingle()

  if (!participant) notFound()

  const { data: allocation } = await supabase
    .from('seoul_budget_allocations')
    .select('id')
    .eq('participant_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [{ records }, { settlements }, { appeals }] = await Promise.all([
    getMonitoringRecords(id),
    allocation ? getSettlements(allocation.id) : Promise.resolve({ settlements: [] }),
    getAppeals(id),
  ])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/admin/participants" aria-label="뒤로 가기" className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
        <h1 className="text-xl font-bold tracking-tight">{participant.name}님 상세</h1>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6">
        <ParticipantDetailClient
          participantId={participant.id}
          allocationId={allocation?.id ?? null}
          monitoringRecords={records}
          settlements={settlements}
          appeals={appeals}
        />
      </main>
    </div>
  )
}
