import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TransactionCalendar from '@/components/transactions/TransactionCalendar'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 당사자의 전체 사용 내역 조회
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, date, amount, activity_name, status, receipt_image_url')
    .eq('participant_id', user.id)
    .order('date', { ascending: false })

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-10">
      <header className="flex h-16 items-center justify-between px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl">←</Link>
          <h1 className="text-xl font-bold tracking-tight">달력</h1>
        </div>
        <div className="flex gap-3 text-[10px] font-bold">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-zinc-500">예산 반영됨</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-zinc-500">확인 대기중</span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <TransactionCalendar transactions={transactions || []} />
      </main>
    </div>
  )
}
