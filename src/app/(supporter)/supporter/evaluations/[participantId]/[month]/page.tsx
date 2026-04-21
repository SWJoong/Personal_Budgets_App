import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EvaluationPageClient from '@/components/evaluations/EvaluationPageClient'
import MonthlyPlanProgressTable from '@/components/evaluations/MonthlyPlanProgressTable'
import GoalEvaluationCards from '@/components/evaluations/GoalEvaluationCards'
import { getEvalTemplateSetting } from '@/app/actions/evalTemplates'
import { getMonthlyPlanProgress } from '@/app/actions/monthlyPlan'
import { getSupportGoals } from '@/app/actions/supportGoal'
import { getGoalEvaluations } from '@/app/actions/goalEvaluation'
import { type EvalTemplateId } from '@/types/eval-templates'
import { parseMonth } from '@/utils/date'

interface Props {
  params: Promise<{ participantId: string; month: string }>
}

export default async function EvaluationDetailPage({ params }: Props) {
  const { participantId, month } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 당사자 정보 조회
  const { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .single()

  if (!participant) redirect('/supporter/evaluations')

  // 해당 월의 거래 내역 요약 정보 조회 (평가 참고용)
  const { startDate, endDate, display: displayMonth } = parseMonth(month)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('participant_id', participantId)
    .gte('date', startDate)
    .lt('date', endDate)
    .eq('status', 'confirmed')

  const totalSpent = transactions?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0
  const count = transactions?.length || 0

  // 기존 평가 데이터 조회
  const { data: existingEvaluation } = await supabase
    .from('evaluations')
    .select('*')
    .eq('participant_id', participantId)
    .eq('month', month)
    .single()

  // 기관 평가 양식 기본 설정 (custom_fields 등 참조용)
  const evalSetting = await getEvalTemplateSetting()

  // 월별 계획 진행률
  const planProgress = await getMonthlyPlanProgress(participantId, month)

  // 지원 목표 + 목표별 평가 (현재 연도 care_plan 기준)
  const currentYear = new Date().getFullYear()
  const { data: carePlans } = await supabase
    .from('care_plans')
    .select('id, plan_year')
    .eq('participant_id', participantId)
    .order('plan_year', { ascending: false })
    .limit(3)
  const carePlan = carePlans?.find(p => p.plan_year === currentYear) ?? carePlans?.[0] ?? null
  const supportGoals = carePlan ? await getSupportGoals(carePlan.id) : []
  const goalEvaluations = existingEvaluation
    ? await getGoalEvaluations(existingEvaluation.id)
    : []

  // 이미 저장된 평가가 있으면 해당 양식 우선, 없으면 기관 기본값
  const initialTemplateId: EvalTemplateId =
    (existingEvaluation?.evaluation_template as EvalTemplateId | undefined) ?? evalSetting.active

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8 pb-20">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/supporter/evaluations" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl font-bold">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{participant.name} 님 월별 평가</h1>
            <p className="text-zinc-500 mt-1">{displayMonth} 활동 기록 및 분석</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link
            href={`/supporter/evaluations/${participantId}/goals`}
            className="px-4 py-2 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-700 font-bold text-sm hover:bg-zinc-50 transition-colors"
          >
            🎯 지원 목표
          </Link>
          <Link
            href={`/supporter/evaluations/${participantId}/${month}/plans`}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors"
          >
            📋 월별 계획 편집
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mb-6">
        <MonthlyPlanProgressTable
          participantId={participantId}
          month={month}
          plans={planProgress}
          editable
        />
      </section>

      {/* 목표별 평가 카드 */}
      {supportGoals.length > 0 && existingEvaluation && (
        <section className="max-w-5xl mb-8">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">목표별 평가 (4+1)</h2>
          <GoalEvaluationCards
            evaluationId={existingEvaluation.id}
            participantId={participantId}
            goals={supportGoals}
            initialEvaluations={goalEvaluations}
          />
        </section>
      )}

      {supportGoals.length > 0 && !existingEvaluation && (
        <section className="max-w-5xl mb-8 bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-700">
          월별 평가를 먼저 저장한 후 목표별 4+1 평가를 작성할 수 있어요.
        </section>
      )}

      <main className="max-w-5xl flex flex-col lg:flex-row gap-8">
        {/* 좌측: 당월 활동 요약 (참고용) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">활동 요약 ({displayMonth})</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <span className="text-sm text-zinc-500 font-medium">총 지출 금액</span>
                <span className="text-xl font-black text-zinc-900">{totalSpent.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-zinc-500 font-medium">확정된 활동 건수</span>
                <span className="text-xl font-black text-zinc-900">{count}건</span>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-zinc-100 flex flex-col gap-2">
              <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">계획별 활동 현황</p>
              {planProgress.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {planProgress.map(plan => (
                    <div key={plan.id} className="text-xs border-b border-zinc-100 pb-2 last:border-0">
                      <div className="font-bold text-zinc-700 truncate mb-0.5">{plan.title}</div>
                      <div className="flex justify-between text-zinc-500">
                        <span>{plan.tx_count}건 실행</span>
                        <span className="font-semibold">{plan.spent_confirmed.toLocaleString()}원</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic py-2 text-center">월별 계획이 없습니다.</p>
              )}
            </div>
          </section>

          <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
            <h4 className="text-blue-800 font-bold text-sm mb-2">💡 작성 팁</h4>
            <p className="text-blue-700 text-xs leading-relaxed">
              당사자의 선택과 경험을 중심으로 기록해 주세요. 수치보다는 당사자가 무엇을 배우고 느꼈는지, 지원자가 무엇을 보았는지가 중요합니다.
              우측에서 기관에 맞는 평가 양식을 선택할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 우측: 양식 선택 + 평가 작성 폼 */}
        <div className="flex-1">
          <EvaluationPageClient
            participantId={participantId}
            month={month}
            initialData={existingEvaluation}
            orgSetting={evalSetting}
            initialTemplateId={initialTemplateId}
          />
        </div>
      </main>
    </div>
  )
}
