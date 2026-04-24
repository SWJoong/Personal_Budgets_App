import { createClient, createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlanChatContainer from '@/components/plans/PlanChatContainer'
import { formatCurrency } from '@/utils/budget-visuals'
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

  // 이번 달 계획 예산 집계
  const totalPlannedBudget = monthlyPlans.reduce((acc, p) => acc + (Number(p.planned_budget) || 0), 0)
  const totalSpentConfirmed = monthlyPlans.reduce((acc, p) => acc + p.spent_confirmed, 0)
  const totalSpentPending = monthlyPlans.reduce((acc, p) => acc + p.spent_pending, 0)

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
          <h1 className="text-sm font-black text-zinc-800">🤔 오늘 계획</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton sectionKey="plan" />
          <NavDropdown />
        </div>
      </header>

      <main className="flex-1 p-4 w-full flex flex-col gap-6">
        {/* 현재 잔액 요약 */}
        <div className="rounded-[2rem] bg-white ring-1 ring-zinc-200 shadow-sm relative overflow-hidden">
          {/* 상단: 잔액 */}
          <div className="p-6 flex justify-between items-center">
            <div className="flex flex-col z-10 relative">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">사용 가능한 돈</span>
              <span className="text-3xl font-black text-zinc-900">
                {totalBalance.toLocaleString()}원
              </span>
            </div>
            <span className="text-5xl z-10 relative">💰</span>
            <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] rotate-12">💰</div>
          </div>

          {/* 하단: 이번 달 계획 예산 요약 (계획이 있을 때만) */}
          {totalPlannedBudget > 0 && (
            <div className="px-6 pb-5 flex flex-col gap-2 border-t border-zinc-100 pt-4">
              {/* 예산 바 */}
              {(() => {
                const pct = Math.min(100, Math.round((totalSpentConfirmed / totalPlannedBudget) * 100))
                const barColor = pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
                return (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
                      <span>이번 달 계획 예산</span>
                      <span>{pct}% 사용</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-label={`이번 달 계획 예산 ${pct}% 사용`}
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                )
              })()}
              {/* 숫자 요약 */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">계획 예산</p>
                  <p className="text-sm font-black text-zinc-700">{formatCurrency(totalPlannedBudget)}원</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">이미 씀</p>
                  <p className="text-sm font-black text-zinc-900">{formatCurrency(totalSpentConfirmed)}원</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">남은 예산</p>
                  <p className={`text-sm font-black ${totalPlannedBudget - totalSpentConfirmed <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {formatCurrency(Math.max(0, totalPlannedBudget - totalSpentConfirmed))}원
                  </p>
                </div>
              </div>
              {totalSpentPending > 0 && (
                <p className="text-[10px] text-orange-500 font-bold text-center">
                  · 대기 중 {formatCurrency(totalSpentPending)}원 포함 예정
                </p>
              )}
            </div>
          )}
        </div>

        {/* 이번 달 할 것들 */}
        {monthlyPlans.length > 0 && (
          <details open className="group">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
              <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">이번 달 할 것들</span>
              <svg
                className="w-4 h-4 text-zinc-400 transition-transform group-open:rotate-180"
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
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
              <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">내가 이루고 싶은 것</span>
              <svg
                className="w-4 h-4 text-zinc-400 transition-transform group-open:rotate-180"
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
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">나의 계획</h2>
            <div className="flex flex-col gap-2">
              {plans.map((plan: any) => {
                const selectedOption = plan.options?.[plan.selected_option_index]
                return (
                  <div key={plan.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedOption?.icon || '📝'}</span>
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
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">새 계획 만들기</h2>
          <PlanChatContainer totalBalance={totalBalance} participantId={user.id} />
        </section>

        {/* 도움말 */}
        <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex gap-4 items-start">
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
