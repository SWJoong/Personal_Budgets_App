import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupportGoals } from '@/app/actions/supportGoal'
import { getMonthlyPlanProgress } from '@/app/actions/monthlyPlan'
import NavDropdown from '@/components/layout/NavDropdown'

const ACHIEVEMENT_LABEL: Record<string, { label: string; icon: string; cls: string }> = {
  achieved:     { label: '달성',   icon: '✓', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  in_progress:  { label: '진행 중', icon: '▶', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  not_achieved: { label: '미달성', icon: '—', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
}

export default async function MyPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 당사자인지 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role === 'admin' || profile?.role === 'supporter') redirect('/')

  // 현재 연도 개인지원계획서
  const currentYear = new Date().getFullYear()
  const { data: carePlans } = await supabase
    .from('care_plans')
    .select('id, plan_year')
    .eq('participant_id', user.id)
    .order('plan_year', { ascending: false })
    .limit(3)
  const carePlan = carePlans?.find(p => p.plan_year === currentYear) ?? carePlans?.[0] ?? null

  const goals = carePlan ? await getSupportGoals(carePlan.id) : []
  const activeGoals = goals.filter(g => g.is_active).sort((a, b) => a.order_index - b.order_index)

  // 이번 달 월별 계획 진행률 (goal 연결용)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthlyProgress = await getMonthlyPlanProgress(user.id, thisMonth)

  // goal별 연결된 월별 계획 맵
  const plansByGoal = new Map<string, typeof monthlyProgress>()
  for (const p of monthlyProgress) {
    const key = (p as any).support_goal_id as string | null
    if (key) {
      const cur = plansByGoal.get(key) ?? []
      cur.push(p)
      plansByGoal.set(key, cur)
    }
  }

  // 이번 달 평가에서 goal_evaluations 조회
  const monthDate = `${thisMonth}-01`
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('id')
    .eq('participant_id', user.id)
    .eq('month', monthDate)
    .single()

  const goalEvalMap = new Map<string, { achievement: string | null }>()
  if (evaluation) {
    const { data: gEvals } = await supabase
      .from('goal_evaluations')
      .select('support_goal_id, achievement')
      .eq('evaluation_id', evaluation.id)
    for (const ge of gEvals || []) {
      goalEvalMap.set((ge as any).support_goal_id, { achievement: (ge as any).achievement })
    }
  }

  const displayYear = carePlan?.plan_year ?? currentYear
  const displayMonth = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 pb-10">
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">아름드리꿈터</span>
          </Link>
          <span className="text-zinc-300">·</span>
          <h1 className="text-sm font-black text-zinc-800">🎯 내 목표</h1>
        </div>
        <NavDropdown />
      </header>

      <main className="flex-1 p-4 flex flex-col gap-5 max-w-lg mx-auto w-full">
        {/* 헤더 카드 */}
        <div className="p-6 rounded-[2rem] bg-white ring-1 ring-zinc-200 shadow-sm">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
            {displayYear}년 나의 지원 계획
          </p>
          <p className="text-xl font-black text-zinc-900">
            올해 {activeGoals.length}개의 목표가 있어요
          </p>
          <p className="text-sm text-zinc-500 mt-1">{displayMonth} 기준으로 보여드려요</p>
        </div>

        {activeGoals.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white ring-1 ring-zinc-200 text-center text-zinc-400 text-sm">
            아직 등록된 목표가 없어요.
            <br />선생님께 문의해 주세요.
          </div>
        ) : (
          activeGoals.map(goal => {
            const evalData = goalEvalMap.get(goal.id)
            const achievement = evalData?.achievement ?? null
            const achieveInfo = achievement ? ACHIEVEMENT_LABEL[achievement] : null
            const linkedPlans = plansByGoal.get(goal.id) ?? []

            return (
              <div key={goal.id} className="bg-white rounded-[1.5rem] ring-1 ring-zinc-200 shadow-sm overflow-hidden">
                {/* 목표 헤더 */}
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-black flex items-center justify-center mt-0.5">
                        {goal.order_index}
                      </span>
                      <div>
                        <p className="font-black text-zinc-900 text-base leading-snug">{goal.support_area}</p>
                        <div className="flex gap-2 mt-1.5">
                          {goal.is_to_goal && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">나에게 중요해요</span>
                          )}
                          {goal.is_for_whom && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">나를 위해 필요해요</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {achieveInfo && (
                      <span className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${achieveInfo.cls}`}>
                        <span>{achieveInfo.icon}</span>
                        <span>{achieveInfo.label}</span>
                      </span>
                    )}
                  </div>

                  {/* 목표 설명 */}
                  {goal.outcome_goal && (
                    <p className="mt-3 text-sm text-zinc-600 leading-relaxed pl-11">{goal.outcome_goal}</p>
                  )}

                  {/* 평가 목표치 */}
                  {goal.eval_target && (
                    <div className="mt-2 pl-11">
                      <span className="text-xs text-zinc-400 font-medium">목표: </span>
                      <span className="text-xs font-bold text-zinc-700">{goal.eval_target}</span>
                    </div>
                  )}
                </div>

                {/* 이번 달 연결된 계획 */}
                {linkedPlans.length > 0 && (
                  <div className="border-t border-zinc-100 px-5 py-3">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">이번 달 계획</p>
                    <div className="flex flex-col gap-2">
                      {linkedPlans.map(plan => {
                        const budgetPct = plan.planned_budget > 0
                          ? Math.min(100, Math.round((plan.spent_confirmed / plan.planned_budget) * 100))
                          : 0
                        return (
                          <div key={plan.id} className="flex items-center gap-3">
                            <span className="text-sm font-bold text-zinc-800 flex-1 truncate">{plan.title}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-20 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                                <div
                                  className="h-full bg-zinc-900 rounded-full transition-all"
                                  style={{ width: `${budgetPct}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-zinc-500 w-8 text-right">{budgetPct}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* 안내 카드 */}
        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex gap-3 items-start">
          <span className="text-xl mt-0.5">💡</span>
          <p className="text-blue-700 text-sm leading-relaxed font-medium">
            목표는 선생님과 함께 정해요. 궁금한 게 있으면 선생님께 물어보세요!
          </p>
        </div>
      </main>
    </div>
  )
}
