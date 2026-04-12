import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CarePlanForm from '@/components/documents/CarePlanForm'
import { getCarePlan } from '@/app/actions/carePlan'
import { CARE_PLAN_LABELS } from '@/types/care-plans'
import type { CarePlanType } from '@/types/care-plans'

interface Props {
  params: Promise<{ participantId: string; planType: string }>
  searchParams: Promise<{ year?: string }>
}

export default async function CarePlanEditPage({ params, searchParams }: Props) {
  const { participantId, planType } = await params
  const { year } = await searchParams

  // 유효한 planType인지 확인
  if (planType !== 'mohw_plan' && planType !== 'seoul_plan') {
    redirect('/supporter/documents')
  }

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

  // 당사자 정보 조회
  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .single()

  if (!participant) redirect('/supporter/documents')

  const planYear = year ? parseInt(year, 10) : new Date().getFullYear()
  const existingPlan = await getCarePlan(participantId, planType as CarePlanType, planYear)

  const planLabel = CARE_PLAN_LABELS[planType as CarePlanType]

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-6 pb-24">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/supporter/documents"
          className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl font-bold"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{planLabel}</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {participant.name} 님 · {planYear}년
          </p>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto">
        <CarePlanForm
          participantId={participantId}
          participantName={participant.name ?? ''}
          planType={planType as CarePlanType}
          planYear={planYear}
          initialData={existingPlan ? { id: existingPlan.id, content: existingPlan.content } : null}
        />
      </main>
    </div>
  )
}
