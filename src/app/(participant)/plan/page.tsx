import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlanComparisonContainer from '@/components/plans/PlanComparisonContainer'

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 당사자의 현재 잔액 조회
  const { data: fundingSources } = await supabase
    .from('funding_sources')
    .select('current_month_balance')
    .eq('participant_id', user.id)

  const totalBalance = fundingSources?.reduce((acc, fs) => acc + Number(fs.current_month_balance), 0) || 0

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground pb-24">
      <header className="flex h-16 items-center gap-3 px-6 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl">←</Link>
        <h1 className="text-xl font-bold tracking-tight">오늘의 계획</h1>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full">
        {/* 현재 잔액 요약 */}
        <div className="mb-10 p-8 rounded-[2.5rem] bg-white ring-1 ring-zinc-200 shadow-sm flex justify-between items-center relative overflow-hidden">
          <div className="flex flex-col z-10 relative">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">사용 가능한 돈</span>
            <span className="text-3xl font-black text-zinc-900">
              {totalBalance.toLocaleString()}원
            </span>
          </div>
          <span className="text-5xl z-10 relative">💰</span>
          <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] rotate-12">💰</div>
        </div>

        {/* 계획 컨테이너 (AI 추천 로직 포함) */}
        <PlanComparisonContainer totalBalance={totalBalance} />

        <div className="mt-12 p-8 rounded-[2.5rem] bg-blue-50 border border-blue-100 flex gap-4 items-start">
          <span className="text-2xl mt-1">💡</span>
          <div className="flex flex-col gap-1">
            <h4 className="text-blue-800 font-bold">도움말</h4>
            <p className="text-blue-600 text-sm leading-relaxed font-medium">
              비용이 적은 방법을 선택하면 나중에 다른 활동을 더 많이 할 수 있어요!
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
