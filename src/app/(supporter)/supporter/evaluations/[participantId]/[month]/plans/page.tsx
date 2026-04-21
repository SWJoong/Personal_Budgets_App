import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MonthlyPlansClient from './MonthlyPlansClient'
import { getMonthlyPlans } from '@/app/actions/monthlyPlan'
import { getSupportGoals } from '@/app/actions/supportGoal'

interface Props {
  params: Promise<{ participantId: string; month: string }>
}

export default async function MonthlyPlansEditPage({ params }: Props) {
  const { participantId, month } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    redirect('/')
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .single()
  if (!participant) redirect('/supporter/evaluations')

  const { data: fundingSources } = await supabase
    .from('funding_sources')
    .select('id, name')
    .eq('participant_id', participantId)
    .order('name', { ascending: true })

  const normalizedMonth = month.length === 7 ? `${month}-01` : month
  const plans = await getMonthlyPlans(participantId, normalizedMonth)

  // 현재 연도 care_plan → support_goals
  const currentYear = new Date().getFullYear()
  const { data: carePlans } = await supabase
    .from('care_plans')
    .select('id, plan_year')
    .eq('participant_id', participantId)
    .order('plan_year', { ascending: false })
    .limit(3)
  const carePlan = carePlans?.find(p => p.plan_year === currentYear) ?? carePlans?.[0] ?? null
  const supportGoals = carePlan
    ? (await getSupportGoals(carePlan.id)).filter(g => g.is_active)
    : []

  const d = new Date(normalizedMonth)
  const displayMonth = `${d.getFullYear()}년 ${d.getMonth() + 1}월`

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8 pb-20">
      <header className="mb-8 flex items-center gap-4">
        <Link
          href={`/supporter/evaluations/${participantId}/${month}`}
          className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl font-bold"
        >←</Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{participant.name} 님 월별 계획 편집</h1>
          <p className="text-zinc-500 mt-1">{displayMonth} · 계획은 최대 6개까지 등록할 수 있어요</p>
        </div>
      </header>

      <main className="max-w-4xl">
        <MonthlyPlansClient
          participantId={participantId}
          month={normalizedMonth}
          initialPlans={plans}
          fundingSources={fundingSources || []}
          supportGoals={supportGoals}
        />
      </main>
    </div>
  )
}
