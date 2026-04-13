import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CarePlanSection from '@/components/documents/CarePlanSection'
import { getAllCarePlans } from '@/app/actions/carePlan'
import EvaluationsPageClient from '@/components/evaluations/EvaluationsPageClient'

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ participant_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  let query = supabase.from('participants').select('id, name')

  if (profile.role === 'supporter') {
    query = query.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await query

  const carePlans = await getAllCarePlans().catch(() => [])

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">계획과 평가</h1>
        <p className="text-zinc-500 mt-1">이용계획서 작성과 월별 평가를 한 곳에서 관리합니다.</p>
      </header>

      <main className="max-w-4xl flex flex-col gap-8">
        <EvaluationsPageClient
          participants={(participants || []).map((p: any) => ({ id: p.id, name: p.name || '이름없음' }))}
          initialParticipantId={params.participant_id}
        />

        {/* 이용계획서 섹션 */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">개인예산 이용계획서</h2>
            <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-500 text-[10px] font-bold">보건복지부형 · 서울형</span>
          </div>
          <CarePlanSection
            participants={(participants || []) as any}
            carePlans={carePlans as any}
          />
        </section>
      </main>
    </div>
  )
}
