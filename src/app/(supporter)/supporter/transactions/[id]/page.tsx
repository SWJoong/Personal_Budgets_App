import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TransactionDetailClient from './TransactionDetailClient'
import { getSignedImageUrl } from '@/app/actions/storage'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TransactionDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    redirect('/')
  }

  const { data: tx } = await supabase
    .from('transactions')
    .select(`
      *,
      participant:participants!transactions_participant_id_fkey ( name ),
      funding_source:funding_sources!transactions_funding_source_id_fkey ( name )
    `)
    .eq('id', id)
    .single()

  // 영수증·활동사진 signed URL 변환 (private 버킷)
  const [signedReceipt, signedActivity] = await Promise.all([
    getSignedImageUrl(tx?.receipt_image_url ?? null, 'receipts'),
    getSignedImageUrl(tx?.activity_image_url ?? null, 'activity-photos'),
  ])
  if (tx) {
    tx.receipt_image_url = signedReceipt ?? tx.receipt_image_url
    tx.activity_image_url = signedActivity ?? tx.activity_image_url
  }

  if (!tx) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link href="/supporter/transactions" className="text-zinc-400 hover:text-zinc-600 mr-3">←</Link>
          <h1 className="text-xl font-bold tracking-tight">내역 상세</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">내역을 찾을 수 없습니다.</p>
        </main>
      </div>
    )
  }

  return <TransactionDetailClient tx={tx} />
}
