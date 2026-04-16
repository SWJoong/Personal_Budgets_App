import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TransactionCalendar from '@/components/transactions/TransactionCalendar'
import { EasyTerm } from '@/components/ui/EasyTerm'
import HelpButton from '@/components/help/HelpButton'
import HelpAutoTrigger from '@/components/help/HelpAutoTrigger'
import { getSignedImageUrls } from '@/app/actions/storage'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 당사자의 전체 사용 내역 조회
  const { data: rawTransactions } = await supabase
    .from('transactions')
    .select('id, date, amount, activity_name, status, receipt_image_url, activity_image_url')
    .eq('participant_id', user.id)
    .order('date', { ascending: false })

  // 영수증·활동사진 signed URL 변환 (private 버킷)
  const signedUrls = await getSignedImageUrls(
    (rawTransactions ?? []).map(t => ({
      id: t.id,
      receiptUrl: t.receipt_image_url ?? null,
      activityUrl: t.activity_image_url ?? null,
    }))
  )
  const transactions = (rawTransactions ?? []).map(t => ({
    ...t,
    receipt_image_url: signedUrls[t.id]?.receipt ?? t.receipt_image_url,
    activity_image_url: signedUrls[t.id]?.activity ?? t.activity_image_url,
  }))

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <HelpAutoTrigger sectionKey="calendar" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">아름드리꿈터</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
        <div className="flex gap-3 text-[10px] font-bold">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-zinc-500">
              <EasyTerm formal="예산 반영됨" easy="돈에서 뺐어요" />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-zinc-500">
              <EasyTerm formal="확인 대기중" easy="선생님이 확인 중" />
            </span>
          </div>
        </div>
        <HelpButton sectionKey="calendar" />
        </div>
      </header>

      <main className="flex-1 w-full p-4">
        <TransactionCalendar transactions={transactions || []} />
      </main>
    </div>
  )
}
