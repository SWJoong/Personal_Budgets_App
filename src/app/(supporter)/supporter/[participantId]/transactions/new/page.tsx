import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import TransactionForm from '@/components/transactions/TransactionForm'

export const dynamic = 'force-dynamic'

export default async function NewTransactionPage({
  params
}: {
  params: Promise<{ participantId: string }>
}) {
  const resolvedParams = await params
  const { participantId } = resolvedParams

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {} // Not setting cookies in SC
      },
    }
  )

  // Fetch participant name for the UI Header
  const { data: participantData } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', participantId)
    .single() as { data: { name: string } | null }

  // Fetch funding sources for this participant so they can select it in the form
  const { data: fundingSources } = await supabase
    .from('funding_sources')
    .select('id, name')
    .eq('participant_id', participantId)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          내역 등록: {participantData?.name || '당사자'}
        </h1>
        <p className="text-gray-500 mt-1">영수증 기반 결제 내역을 수동으로 입력합니다.</p>
      </div>
      
      <TransactionForm 
        participantId={participantId} 
        fundingSources={fundingSources || []} 
      />
    </div>
  )
}
