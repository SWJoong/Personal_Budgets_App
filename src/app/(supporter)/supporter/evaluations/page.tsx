import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CarePlanSection from '@/components/documents/CarePlanSection'
import { getAllCarePlans } from '@/app/actions/carePlan'
import EvaluationsPageClient from '@/components/evaluations/EvaluationsPageClient'
import MonthlyPlanProgressTable from '@/components/evaluations/MonthlyPlanProgressTable'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import { getMonthlyPlanProgress } from '@/app/actions/monthlyPlan'
import { parseMonth, getRecentMonths } from '@/utils/date'
import { formatCurrency } from '@/utils/budget-visuals'

// ── 통일된 섹션 카드 래퍼 ────────────────────────────────────────────────────
function SectionCard({
  id,
  icon,
  title,
  badge,
  accentClass = 'text-zinc-700',
  borderClass = 'border-zinc-200',
  defaultOpen = true,
  children,
}: {
  id: string
  icon: string
  title: string
  badge?: React.ReactNode
  accentClass?: string
  borderClass?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={`group bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden`}
    >
      <summary
        className={`flex items-center justify-between gap-3 px-6 py-4 cursor-pointer select-none list-none border-b ${borderClass} group-open:border-b group-not-open:border-b-0 transition-colors hover:bg-zinc-50`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base leading-none">{icon}</span>
          <span className={`text-sm font-black ${accentClass}`}>{title}</span>
          {badge}
        </div>
        <svg
          className="w-4 h-4 text-zinc-400 transition-transform group-open:rotate-180 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-6 py-5">
        {children}
      </div>
    </details>
  )
}

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ participant_id?: string; month?: string }>
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

  const selectedId = params.participant_id || participants?.[0]?.id
  const selectedMonthRaw = params.month || getRecentMonths(1)[0].value
  const { year: selectedYear } = parseMonth(selectedMonthRaw)
  const selectedName = participants?.find((p: any) => p.id === selectedId)?.name

  let inlineData: {
    participant: { id: string; name: string } | null
    displayMonth: string
    month: string
    totalSpent: number
    txCount: number
    planProgress: any[]
    existingEvaluation: any | null
    transactions: any[]
  } | null = null

  if (selectedId && selectedMonthRaw) {
    const { startDate, endDate, display } = parseMonth(selectedMonthRaw)

    const { data: participant } = await supabase
      .from('participants')
      .select('id, name')
      .eq('id', selectedId)
      .single()

    if (participant) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, monthly_plan:monthly_plans(id, title, order_index)')
        .eq('participant_id', selectedId)
        .gte('date', startDate)
        .lt('date', endDate)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })

      const totalSpent = transactions?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0

      const { data: existingEvaluation } = await supabase
        .from('evaluations')
        .select('*')
        .eq('participant_id', selectedId)
        .eq('month', startDate)
        .single()

      const planProgress = await getMonthlyPlanProgress(selectedId, startDate)

      inlineData = {
        participant: { id: participant.id, name: participant.name || '이름없음' },
        displayMonth: display,
        month: startDate,
        totalSpent,
        txCount: transactions?.length || 0,
        planProgress,
        existingEvaluation,
        transactions: transactions || [],
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-6 md:p-8">
      {/* 페이지 헤더 */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">계획과 평가</h1>
          <p className="text-zinc-500 text-sm mt-1">이용계획서 작성과 월별 평가를 한 곳에서 관리합니다.</p>
        </div>
        <AdminHelpButton pageKey="evaluations" />
      </header>

      <main className="max-w-5xl flex flex-col gap-4">

        {/* 당사자·월 선택 카드 */}
        <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm px-6 py-5">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">월별 평가 작성 / 조회</p>
          <p className="text-xs text-zinc-500 mb-4">당사자와 월을 선택하면 아래에서 바로 평가 내용을 확인할 수 있습니다.</p>
          <EvaluationsPageClient
            participants={(participants || []).map((p: any) => ({ id: p.id, name: p.name || '이름없음' }))}
            initialParticipantId={selectedId}
          />
        </div>

        {inlineData && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">

            {/* 당사자·월 헤더 */}
            <div className="flex items-center justify-between gap-4 px-1">
              <div>
                <h2 className="text-xl font-black text-zinc-900">
                  {inlineData.participant?.name} 님 — {inlineData.displayMonth}
                </h2>
                <p className="text-sm font-bold mt-0.5">
                  {inlineData.existingEvaluation
                    ? <span className="text-emerald-600">✅ 평가 작성 완료</span>
                    : <span className="text-zinc-400">📝 평가 미작성</span>}
                </p>
              </div>
              <Link
                href={`/supporter/evaluations/${inlineData.participant?.id}/${inlineData.month}`}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors shadow-sm"
              >
                ✏️ 월별 평가 기록하기
              </Link>
            </div>

            {/* ① 월별 활동 요약 */}
            <SectionCard
              id="section-summary"
              icon="📊"
              title="월별 활동 요약"
              accentClass="text-zinc-800"
              borderClass="border-zinc-100"
              defaultOpen={true}
              badge={
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold">
                  {inlineData.displayMonth}
                </span>
              }
            >
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">총 지출</p>
                  <p className="text-2xl font-black text-zinc-900">{formatCurrency(inlineData.totalSpent)}원</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">활동 건수</p>
                  <p className="text-2xl font-black text-zinc-900">{inlineData.txCount}건</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">계획 수</p>
                  <p className="text-2xl font-black text-zinc-900">{inlineData.planProgress.length}개</p>
                </div>
              </div>
            </SectionCard>

            {/* ② 예산 사용 내역 */}
            <SectionCard
              id="section-budget"
              icon="💳"
              title="예산 사용 내역"
              accentClass="text-blue-800"
              borderClass="border-blue-100"
              defaultOpen={true}
              badge={
                inlineData.planProgress.some((p: any) => !p.easy_description) && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                    쉬운 설명 미작성 있음
                  </span>
                )
              }
            >
              <div className="flex flex-col gap-4 -mx-6 px-0">
                <div className="px-0">
                  <MonthlyPlanProgressTable
                    participantId={inlineData.participant!.id}
                    month={inlineData.month}
                    plans={inlineData.planProgress}
                    editable={false}
                  />
                </div>

                {/* 당사자용 쉬운 정보 미리보기 */}
                {inlineData.planProgress.length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">당사자용 쉬운 설명 현황</p>
                      <Link
                        href={`/supporter/evaluations/${inlineData.participant?.id}/${inlineData.month.slice(0,7)}/plans`}
                        className="text-[10px] font-bold text-blue-600 underline underline-offset-2 hover:text-blue-800"
                      >
                        편집하기 →
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {inlineData.planProgress.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white ring-1 ring-blue-200 text-xs">
                          <span className="w-5 h-5 rounded-lg bg-zinc-900 text-white font-black text-[10px] flex items-center justify-center shrink-0">{p.order_index}</span>
                          {p.easy_description
                            ? <span className="font-bold text-zinc-800">{p.easy_description}</span>
                            : <span className="text-amber-600 font-bold italic">미작성</span>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 최근 거래 내역 */}
                {inlineData.transactions.length > 0 && (
                  <div className="bg-white rounded-2xl ring-1 ring-zinc-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        최근 거래 내역 ({inlineData.displayMonth})
                      </p>
                      <Link
                        href={`/supporter/transactions?participant=${inlineData.participant?.id}`}
                        className="text-xs font-bold text-zinc-500 hover:text-zinc-700 underline underline-offset-2"
                      >
                        전체 보기 →
                      </Link>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-2 text-left">날짜</th>
                          <th className="px-4 py-2 text-left">활동</th>
                          <th className="px-4 py-2 text-left">계획</th>
                          <th className="px-4 py-2 text-right">금액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {inlineData.transactions.slice(0, 10).map((tx: any) => (
                          <tr key={tx.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-6 py-3 text-zinc-500 text-xs">{tx.date}</td>
                            <td className="px-4 py-3 font-bold text-zinc-900">{tx.activity_name}</td>
                            <td className="px-4 py-3 text-xs text-zinc-500">
                              {tx.monthly_plan?.title || <span className="italic text-zinc-300">계획 외</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-zinc-900">
                              {formatCurrency(Number(tx.amount))}원
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {inlineData.transactions.length > 10 && (
                      <p className="text-center text-xs text-zinc-400 py-3 border-t border-zinc-100">
                        외 {inlineData.transactions.length - 10}건 더 있음
                      </p>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* ③ 월별 평가 결과 */}
            {inlineData.existingEvaluation && (
              <SectionCard
                id="section-evaluation"
                icon="📝"
                title="월별 평가 결과"
                accentClass="text-emerald-800"
                borderClass="border-emerald-100"
                defaultOpen={true}
              >
                {inlineData.existingEvaluation.easy_summary && (
                  <div className="bg-emerald-50 rounded-xl p-4 mb-4 border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5">쉬운 요약</p>
                    <p className="text-sm text-emerald-900 font-bold leading-relaxed">
                      {inlineData.existingEvaluation.easy_summary}
                    </p>
                  </div>
                )}
                {inlineData.existingEvaluation.content && (
                  <p className="text-sm text-zinc-700 leading-relaxed line-clamp-5 whitespace-pre-wrap">
                    {typeof inlineData.existingEvaluation.content === 'string'
                      ? inlineData.existingEvaluation.content
                      : JSON.stringify(inlineData.existingEvaluation.content, null, 2).slice(0, 500)}
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-end">
                  <Link
                    href={`/supporter/evaluations/${inlineData.participant?.id}/${inlineData.month}`}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                  >
                    평가 전체 보기 / 편집하기 →
                  </Link>
                </div>
              </SectionCard>
            )}

            {/* ④ 연간 지원 계획 */}
            <SectionCard
              id="section-care-plan"
              icon="📁"
              title="연간 지원 계획"
              accentClass="text-violet-800"
              borderClass="border-violet-100"
              defaultOpen={false}
              badge={
                <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold">
                  보건복지부형 · 서울형 · 직접지급형
                </span>
              }
            >
              <CarePlanSection
                selectedParticipantId={selectedId}
                selectedParticipantName={selectedName}
                selectedYear={selectedYear}
                carePlans={carePlans as any}
              />
            </SectionCard>

          </div>
        )}
      </main>
    </div>
  )
}
