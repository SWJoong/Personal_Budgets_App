import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReviewQueueClient from '@/components/transactions/ReviewQueueClient'

export default async function ReviewQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  // 미확인(pending) 거래 조회 — 담당 당사자만 (지원자), 전체 (관리자)
  let participantsQuery = supabase
    .from('participants')
    .select('id, name, funding_sources(id, name)')

  if (profile.role === 'supporter') {
    participantsQuery = participantsQuery.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await participantsQuery
  const participantIds = (participants ?? []).map((p: any) => p.id)

  // 재원 맵 (participant_id → FundingSource[])
  const allFundingSources: Record<string, { id: string; name: string }[]> = {}
  for (const p of participants ?? []) {
    allFundingSources[(p as any).id] = ((p as any).funding_sources ?? []).map((fs: any) => ({
      id: fs.id,
      name: fs.name,
    }))
  }

  // pending 거래 조회
  let txQuery = supabase
    .from('transactions')
    .select(`
      id,
      participant_id,
      activity_name,
      amount,
      date,
      category,
      payment_method,
      receipt_image_url,
      funding_source_id,
      participants!transactions_participant_id_fkey ( name ),
      funding_sources!transactions_funding_source_id_fkey ( name )
    `)
    .eq('status', 'pending')
    .order('date', { ascending: false })

  if (profile.role === 'supporter' && participantIds.length > 0) {
    txQuery = txQuery.in('participant_id', participantIds)
  }

  const { data: rawTx } = await txQuery

  const transactions = (rawTx ?? []).map((t: any) => ({
    id: t.id,
    participant_id: t.participant_id,
    participant_name: t.participants?.name ?? '알 수 없음',
    activity_name: t.activity_name,
    amount: Number(t.amount),
    date: t.date,
    category: t.category ?? '기타',
    payment_method: t.payment_method ?? '',
    receipt_image_url: t.receipt_image_url ?? null,
    funding_source_id: t.funding_source_id ?? null,
    funding_source_name: t.funding_sources?.name ?? null,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center gap-3 mb-8">
        <Link
          href="/supporter/transactions"
          className="text-zinc-400 hover:text-zinc-600 transition-colors text-xl"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">영수증 검토 대기열</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            당사자가 올린 영수증을 확인하고 잔액에 반영해요
          </p>
        </div>
        {transactions.length > 0 && (
          <span className="ml-auto px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-sm font-black">
            {transactions.length}건 대기
          </span>
        )}
      </header>

      <main className="w-full max-w-2xl flex flex-col gap-4">
        <ReviewQueueClient
          transactions={transactions}
          allFundingSources={allFundingSources}
        />
      </main>
    </div>
  )
}
