import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SupportGoalsForm from '@/components/evaluations/SupportGoalsForm'
import BudgetLineItemsTable from '@/components/evaluations/BudgetLineItemsTable'
import { getSupportGoals } from '@/app/actions/supportGoal'
import { getBudgetLineItems } from '@/app/actions/budgetLineItem'

interface Props {
  params: Promise<{ participantId: string }>
}

export default async function SupportGoalsPage({ params }: Props) {
  const { participantId } = await params
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

  // 현재 연도 개인지원계획서 조회 (없으면 가장 최근 것)
  const currentYear = new Date().getFullYear()
  const { data: carePlans } = await supabase
    .from('care_plans')
    .select('id, plan_year, plan_type')
    .eq('participant_id', participantId)
    .order('plan_year', { ascending: false })
    .limit(5)

  const carePlan = carePlans?.find(p => p.plan_year === currentYear) ?? carePlans?.[0] ?? null

  const { data: fundingSources } = await supabase
    .from('funding_sources')
    .select('id, name')
    .eq('participant_id', participantId)
    .order('name', { ascending: true })

  const goals = carePlan ? await getSupportGoals(carePlan.id) : []
  const lineItems = carePlan ? await getBudgetLineItems(carePlan.id) : []

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8 pb-20">
      <header className="mb-8 flex items-center gap-4">
        <Link
          href="/supporter/evaluations"
          className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl font-bold"
        >←</Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{participant.name} 님 지원 목표</h1>
          <p className="text-zinc-500 mt-1">
            {carePlan
              ? `${carePlan.plan_year}년 개인지원계획서 기준 · 연간 지원 목표`
              : '등록된 계획서가 없어요'}
          </p>
        </div>
      </header>

      {!carePlan ? (
        <div className="max-w-2xl bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-800 text-sm">
          개인지원계획서(care_plan)를 먼저 등록해 주세요. 서류 보관함에서 추가할 수 있어요.
        </div>
      ) : (
        <main className="max-w-4xl flex flex-col gap-10">
          {/* 지원 목표 섹션 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-zinc-900">연간 지원 목표</h2>
              <span className="text-xs text-zinc-400 font-bold">{goals.length}/10</span>
            </div>
            <SupportGoalsForm
              carePlanId={carePlan.id}
              participantId={participantId}
              initialGoals={goals}
            />
          </section>

          {/* 예산 세목 섹션 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-zinc-900">예산 세목 (산출내역)</h2>
              <span className="text-xs text-zinc-400 font-bold">{lineItems.length}개 항목</span>
            </div>
            <BudgetLineItemsTable
              carePlanId={carePlan.id}
              participantId={participantId}
              initialItems={lineItems}
              supportGoals={goals}
              fundingSources={fundingSources || []}
            />
          </section>
        </main>
      )}
    </div>
  )
}
