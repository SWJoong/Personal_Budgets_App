import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import NewTransactionClient from './NewTransactionClient'

/**
 * 지출 기록 폼 (GOAL축 A) — 담당자·당사자가 예산 배정에 대해 지출을 기록한다.
 * recordServiceUsage 액션 사용. 예산 배정(seoul_budget_allocations)이 있어야 기록 가능.
 */
export const metadata = { title: '지출 추가' }

export default async function NewTransactionPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  const [{ data: allocations }, { data: domains }, { data: subdomains }] = await Promise.all([
    supabase
      .from('seoul_budget_allocations')
      .select('id, allocated_amount, total_ceiling, starts_on, ends_on')
      .eq('participant_id', participantId)
      .order('starts_on', { ascending: false }),
    supabase
      .from('seoul_service_domains')
      .select('id, program, code, label, sort_order')
      .order('program', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('seoul_service_subdomains')
      .select('id, domain_id, code, label, sort_order')
      .order('sort_order', { ascending: true }),
  ])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href={`/supporter/${participantId}/transactions`}
          aria-label="뒤로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight truncate">지출 기록 · {participant.name}님</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <NewTransactionClient
          participantId={participantId}
          allocations={allocations ?? []}
          domains={domains ?? []}
          subdomains={subdomains ?? []}
        />
      </main>
    </div>
  )
}
