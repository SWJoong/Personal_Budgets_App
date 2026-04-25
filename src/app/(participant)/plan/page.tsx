import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlanChatContainer from '@/components/plans/PlanChatContainer'
import { formatCurrency } from '@/utils/budget-visuals'
import { getActivityEmoji } from '@/utils/activityEmoji'
import HelpButton from '@/components/help/HelpButton'
import HelpAutoTrigger from '@/components/help/HelpAutoTrigger'
import NavDropdown from '@/components/layout/NavDropdown'
import MonthlyPlanEasyCard from '@/components/plans/MonthlyPlanEasyCard'
import SupportGoalEasyCard from '@/components/plans/SupportGoalEasyCard'
import { getMonthlyPlanProgress } from '@/app/actions/monthlyPlan'

const EASY_READ_SIGNED_URL_TTL = 86400 // 24시간

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 현재 월 (KST)
  const now = new Date()
  const kstOffset = 9 * 60
  const kstDate = new Date(now.getTime() + kstOffset * 60 * 1000)
  const currentMonth = kstDate.toISOString().slice(0, 7) + '-01'

  // 당사자의 현재 잔액 조회
  const { data: fundingSources } = await supabase
    .from('funding_sources')
    .select('current_month_balance')
    .eq('participant_id', user.id)

  const totalBalance = fundingSources?.reduce((acc: number, fs: any) => acc + Number(fs.current_month_balance), 0) || 0

  // 저장된 계획 목록 조회 (최근 5개)
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('participant_id', user.id)
    .order('date', { ascending: false })
    .limit(5)

  // 이번 달 월별계획 + 진행률
  const monthlyPlans = await getMonthlyPlanProgress(user.id, currentMonth)

  // 최신 이용계획서 → 지원목표 조회
  const { data: carePlan } = await supabase
    .from('care_plans')
    .select('id')
    .eq('participant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let supportGoals: { id: string; order_index: number; support_area: string; easy_description: string | null; easy_image_url: string | null }[] = []
  if (carePlan) {
    const { data: goalsData } = await supabase
      .from('support_goals')
      .select('id, order_index, support_area, easy_description, easy_image_url')
      .eq('care_plan_id', carePlan.id)
      .eq('is_active', true)
      .order('order_index', { ascending: true })
    supportGoals = goalsData || []
  }

  // Easy Read 이미지 signed URL 배치 생성 (activity-photos 버킷)
  const admin = createAdminClient()

  async function toSignedUrl(path: string | null): Promise<string | null> {
    if (!path) return null
    const { data } = await admin.storage
      .from('activity-photos')
      .createSignedUrl(path, EASY_READ_SIGNED_URL_TTL)
    return data?.signedUrl ?? null
  }

  // 월별계획 이미지 signed URL
  const planSignedUrls = await Promise.all(
    monthlyPlans.map(p => toSignedUrl(p.easy_image_url))
  )

  // 지원목표 이미지 signed URL
  const goalSignedUrls = await Promise.all(
    supportGoals.map(g => toSignedUrl(g.easy_image_url))
  )

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <HelpAutoTrigger sectionKey="plan" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">아름드리꿈터</span>
          </Link>
          <span className="text-zinc-300">·</span>
          <h1 className="text-sm font-black text-zinc-800">🤔 나의 계획</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton sectionKey="plan" />
          <NavDropdown />
        </div>
      </header>

      <main className="flex-1 p-4 w-full flex flex-col gap-8">

        {/* 이번 달 할 것들 */}
        {monthlyPlans.length > 0 && (
          <details open className="group flex flex-col gap-3">
            <summary className="flex items-center justify-between cursor-pointer list-none select-none">
              <div className="flex items-center gap-3 pl-3 border-l-4 border-blue-400">
                <div>
                  <h2 className="text-base font-black text-zinc-800">📅 이번 달 할 것들</h2>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">이번 달 활동 계획과 진행 현황</p>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="flex gap-3 overflow-x-auto pb-2 mt-3 snap-x snap-mandatory scrollbar-none">
              {monthlyPlans.map((plan, i) => (
                <MonthlyPlanEasyCard
                  key={plan.id}
                  id={plan.id}
                  orderIndex={plan.order_index}
                  title={plan.title}
                  easyDescription={plan.easy_description}
                  easyImageUrl={planSignedUrls[i]}
                  targetCount={plan.target_count}
                  txCount={plan.tx_count}
                  plannedBudget={Number(plan.planned_budget) || 0}
                  spentConfirmed={plan.spent_confirmed || 0}
                  spentPending={plan.spent_pending || 0}
                />
              ))}
            </div>
          </details>
        )}

        {/* 내가 이루고 싶은 것 */}
        {supportGoals.length > 0 && (
          <details className="group flex flex-col gap-3">
            <summary className="flex items-center justify-between cursor-pointer list-none select-none">
              <div className="flex items-center gap-3 pl-3 border-l-4 border-violet-400">
                <div>
                  <h2 className="text-base font-black text-zinc-800">⭐ 내가 이루고 싶은 것</h2>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">나의 지원 목표</p>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div
              className="flex gap-3 overflow-x-auto pb-2 mt-3 snap-x snap-mandatory scrollbar-none"
              role="list"
              aria-label="내가 이루고 싶은 것 목록"
            >
              {supportGoals.map((goal, i) => (
                <div key={goal.id} role="listitem">
                  <SupportGoalEasyCard
                    id={goal.id}
                    orderIndex={goal.order_index}
                    supportArea={goal.support_area}
                    easyDescription={goal.easy_description}
                    easyImageUrl={goalSignedUrls[i]}
                  />
                </div>
              ))}
            </div>
          </details>
        )}

        {/* 저장된 계획 목록 */}
        {plans && plans.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3 pl-3 border-l-4 border-emerald-400">
              <div>
                <h2 className="text-base font-black text-zinc-800">📋 저장한 계획</h2>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">AI로 만든 활동 계획 목록</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {plans.map((plan: any) => {
                const selectedOption = plan.options?.[plan.selected_option_index]
                return (
                  <div key={plan.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedOption?.icon || getActivityEmoji(plan.activity_name)}</span>
                      <div>
                        <p className="font-black text-zinc-800 text-sm">{plan.activity_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-zinc-400">{plan.date}</span>
                          {selectedOption && (
                            <span className="text-[10px] font-bold text-zinc-500">
                              · {selectedOption.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {selectedOption && (
                        <p className="font-black text-zinc-800 text-sm">{formatCurrency(selectedOption.cost)}원</p>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">계획했어요</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 채팅형 계획 세우기 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3 pl-3 border-l-4 border-orange-400">
            <div>
              <h2 className="text-base font-black text-zinc-800">✨ 새 계획 만들기</h2>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">AI와 함께 오늘 활동을 계획해요</p>
            </div>
          </div>
          <PlanChatContainer totalBalance={totalBalance} participantId={user.id} />
        </section>

        {/* 도움말 */}
        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex gap-3 items-start">
          <span className="text-xl mt-0.5">💡</span>
          <p className="text-blue-700 text-sm leading-relaxed font-medium">
            비용이 적은 방법을 선택하면 나중에 다른 활동을 더 많이 할 수 있어요!
          </p>
        </div>
      </main>
    </div>
  )
}
