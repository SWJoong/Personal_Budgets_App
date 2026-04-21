import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'
import { getMonthlyPlanProgress } from '@/app/actions/monthlyPlan'
import { getSupportGoals } from '@/app/actions/supportGoal'
import { getRecentMonths } from '@/utils/date'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ParticipantDashboardPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name, birth_date, funding_sources ( id, name, monthly_budget, current_month_balance, current_year_balance )')
    .eq('id', id)
    .single()

  if (!participant) redirect('/supporter/participants')

  const currentMonth = getRecentMonths(1)[0].value

  const [planProgress, { data: recentTx }, { data: carePlans }] = await Promise.all([
    getMonthlyPlanProgress(id, currentMonth),
    supabase
      .from('transactions')
      .select('id, date, activity_name, amount, status, category')
      .eq('participant_id', id)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('care_plans')
      .select('id, plan_year')
      .eq('participant_id', id)
      .order('plan_year', { ascending: false })
      .limit(1),
  ])

  const carePlan = carePlans?.[0] ?? null
  const supportGoals = carePlan ? await getSupportGoals(carePlan.id) : []

  const fsList = (participant as any).funding_sources || []
  const totalBudget = fsList.reduce((a: number, fs: any) => a + Number(fs.monthly_budget || 0), 0)
  const totalBalance = fsList.reduce((a: number, fs: any) => a + Number(fs.current_month_balance || 0), 0)
  const totalYearBalance = fsList.reduce((a: number, fs: any) => a + Number(fs.current_year_balance || 0), 0)

  const [cy, cm] = currentMonth.split('-').map(Number)
  const displayMonth = `${cy}년 ${cm}월`

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-4 sm:p-8 pb-16">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/supporter/participants" className="text-zinc-400 hover:text-zinc-600 text-2xl font-bold">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{(participant as any).name} 님 통합 현황</h1>
          <p className="text-zinc-500 mt-0.5 text-sm">예산 · 계획 · 목표 · 최근 거래 요약</p>
        </div>
      </header>

      <main className="w-full max-w-5xl flex flex-col gap-6">

        {/* ① 예산 요약 */}
        <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">예산 현황</h2>
            <Link href={`/admin/participants/${id}`} className="text-xs font-bold text-zinc-400 hover:text-zinc-700 underline underline-offset-2">상세 →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">월 예산</p>
              <p className="text-xl font-black text-zinc-900 mt-0.5">{formatCurrency(totalBudget)}원</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">이번 달 잔액</p>
              <p className={`text-xl font-black mt-0.5 ${totalBalance < totalBudget * 0.2 ? 'text-red-600' : 'text-zinc-900'}`}>{formatCurrency(totalBalance)}원</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">연간 잔액</p>
              <p className="text-xl font-black text-zinc-900 mt-0.5">{formatCurrency(totalYearBalance)}원</p>
            </div>
          </div>
          {fsList.length > 1 && (
            <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col gap-2">
              {fsList.map((fs: any) => (
                <div key={fs.id} className="flex justify-between text-xs text-zinc-600">
                  <span className="font-medium">{fs.name}</span>
                  <span>{formatCurrency(Number(fs.current_month_balance || 0))}원 잔액</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ② 이번 달 월별 계획 진행률 */}
        <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">{displayMonth} 계획 진행</h2>
            <Link href={`/supporter/evaluations/${id}/${currentMonth}`} className="text-xs font-bold text-zinc-400 hover:text-zinc-700 underline underline-offset-2">평가 작성 →</Link>
          </div>
          {planProgress.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">등록된 월별 계획이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {planProgress.map(p => {
                const pct = Number(p.planned_budget) > 0
                  ? Math.min(100, Math.round((p.spent_confirmed / Number(p.planned_budget)) * 100))
                  : 0
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-zinc-700 truncate">{p.title}</span>
                        <span className="text-zinc-400 shrink-0 ml-2">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-500' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-zinc-400 shrink-0">{formatCurrency(p.spent_confirmed)}원</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ③ 지원 목표 요약 */}
        <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">연간 지원 목표 ({carePlan?.plan_year ?? '—'})</h2>
            <Link href={`/supporter/evaluations/${id}/goals`} className="text-xs font-bold text-zinc-400 hover:text-zinc-700 underline underline-offset-2">편집 →</Link>
          </div>
          {supportGoals.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">등록된 지원 목표가 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {supportGoals.map((g: any) => (
                <div key={g.id} className="flex items-start gap-2 text-sm">
                  <span className="text-zinc-400 font-bold shrink-0">{g.order_index}.</span>
                  <div className="flex-1">
                    <span className="font-semibold text-zinc-800">{g.support_area}</span>
                    {g.outcome_goal && (
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{g.outcome_goal}</p>
                    )}
                  </div>
                  {!g.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-400">비활성</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ④ 최근 거래 5건 */}
        <section className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">최근 거래</h2>
            <Link href={`/supporter/transactions?participant=${id}`} className="text-xs font-bold text-zinc-400 hover:text-zinc-700 underline underline-offset-2">전체 보기 →</Link>
          </div>
          {(!recentTx || recentTx.length === 0) ? (
            <p className="text-sm text-zinc-400 text-center py-4">거래 내역이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentTx.map((t: any) => (
                <Link
                  key={t.id}
                  href={`/supporter/transactions/${t.id}`}
                  className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'confirmed' ? 'bg-green-500' : 'bg-orange-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{t.activity_name}</p>
                      <p className="text-xs text-zinc-400">{t.date} · {t.category || '미분류'}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-zinc-900 shrink-0">{formatCurrency(Number(t.amount))}원</span>
                </Link>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
