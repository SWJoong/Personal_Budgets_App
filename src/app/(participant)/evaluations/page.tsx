import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EvalLetterCard from '@/components/evaluations/EvalLetterCard'
import { EasyTerm } from '@/components/ui/EasyTerm'

export default async function ParticipantEvaluationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 당사자의 월별 평가 데이터 조회
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select('*')
    .eq('participant_id', user.id)
    .order('month', { ascending: false })

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground pb-24">
      <header className="flex h-16 items-center gap-3 px-6 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/more" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl">←</Link>
        <h1 className="text-xl font-bold tracking-tight">
          <EasyTerm formal="지원자 선생님의 편지" easy="선생님이 써준 편지" />
        </h1>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full flex flex-col gap-6">
        <div className="mb-4">
          <h2 className="text-lg font-black text-zinc-800">
            <EasyTerm formal="한 달 돌아보기" easy="한 달 동안 한 일 확인하기" />
          </h2>
          <p className="text-sm font-medium text-zinc-500">선생님이 써준 나의 활동 이야기를 확인해요.</p>
        </div>

        {(!evaluations || evaluations.length === 0) ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 bg-white rounded-[3rem] ring-1 ring-zinc-100">
            <span className="text-6xl">📮</span>
            <p className="text-zinc-400 font-bold">아직 도착한 이야기가 없어요.<br/>활동이 끝나면 선생님이 써줄 거예요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {evaluations.map((evalItem: any) => {
              const date = new Date(evalItem.month)
              const displayMonth = `${date.getFullYear()}년 ${date.getMonth() + 1}월`
              
              return (
                <EvalLetterCard
                  key={evalItem.id}
                  displayMonth={displayMonth}
                  summary={evalItem.easy_summary || evalItem.pleased || "선생님이 이번 달 활동을 정리하고 있어요. 조금만 기다려주세요!"}
                  nextStep={evalItem.next_step || "즐겁게 활동하기!"}
                />
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
