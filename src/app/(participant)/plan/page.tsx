import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlanComparison from '@/components/plans/PlanComparison'

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

  // 샘플 데이터 (향후 DB에서 'activity_suggestions' 또는 'plans'를 통해 가져올 수 있음)
  const sampleActivity = "카페 가기"
  const sampleOptions = [
    { name: "별다방 (스타벅스)", cost: 6500, time: "30분", icon: "☕", description: "맛있는 커피와 조용한 분위기" },
    { name: "편의점 커피", cost: 1500, time: "5분", icon: "🏪", description: "빠르고 저렴하게 마실 수 있어요" }
  ]

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-24">
      <header className="flex h-16 items-center gap-3 px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl">←</Link>
        <h1 className="text-2xl font-bold tracking-tight">오늘의 계획</h1>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full">
        {/* 현재 잔액 요약 */}
        <div className="mb-10 p-6 rounded-3xl bg-zinc-50 border border-zinc-100 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">사용 가능한 돈</span>
            <span className="text-2xl font-black text-zinc-900">
              {totalBalance.toLocaleString()}원
            </span>
          </div>
          <span className="text-3xl">💰</span>
        </div>

        {/* 계획 비교 UI */}
        <PlanComparison 
          activityName={sampleActivity}
          initialOptions={sampleOptions}
          currentBalance={totalBalance}
        />

        <div className="mt-12 p-6 rounded-[2rem] bg-blue-50 border border-blue-100">
          <h4 className="text-blue-800 font-bold mb-2">💡 팁</h4>
          <p className="text-blue-600 text-sm leading-relaxed font-medium">
            비용이 적은 방법을 선택하면 나중에 다른 활동을 더 많이 할 수 있어요!
          </p>
        </div>
      </main>
    </div>
  )
}
