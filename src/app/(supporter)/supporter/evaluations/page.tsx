import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CarePlanSection from '@/components/documents/CarePlanSection'
import { getAllCarePlans } from '@/app/actions/carePlan'
import EvaluationsPageClient from '@/components/evaluations/EvaluationsPageClient'
import MonthlyPlanProgressTable from '@/components/evaluations/MonthlyPlanProgressTable'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import { getMonthlyPlanProgress } from '@/app/actions/monthlyPlan'
import { parseMonth } from '@/utils/date'
import { formatCurrency } from '@/utils/budget-visuals'

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

  // ── 선택된 당사자 + 월이 있으면 인라인 평가 데이터 조회 ──
  const selectedId = params.participant_id || participants?.[0]?.id
  const selectedMonthRaw = params.month

  // 인라인 평가 데이터
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
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">계획과 평가</h1>
          <p className="text-zinc-500 mt-1">이용계획서 작성과 월별 평가를 한 곳에서 관리합니다.</p>
        </div>
        <AdminHelpButton pageKey="evaluations" />
      </header>

      <main className="max-w-5xl flex flex-col gap-8">
        <EvaluationsPageClient
          participants={(participants || []).map((p: any) => ({ id: p.id, name: p.name || '이름없음' }))}
          initialParticipantId={selectedId}
          initialMonth={selectedMonthRaw}
        />

        {/* ── 인라인 평가 미리보기 (드롭다운으로 선택한 당사자+월) ── */}
        {inlineData && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  {inlineData.participant?.name} 님 — {inlineData.displayMonth}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {inlineData.existingEvaluation ? '✅ 평가 작성됨' : '📝 평가 미작성'}
                </p>
              </div>
              <Link
                href={`/supporter/evaluations/${inlineData.participant?.id}/${inlineData.month}`}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors"
              >
                ✏️ 평가 상세 / 편집
              </Link>
            </div>

            {/* 월별 계획 진행률 */}
            <MonthlyPlanProgressTable
              participantId={inlineData.participant!.id}
              month={inlineData.month}
              plans={inlineData.planProgress}
              editable={false}
            />

            {/* 활동 요약 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">총 지출</p>
                <p className="text-2xl font-black text-zinc-900 mt-1">{formatCurrency(inlineData.totalSpent)}원</p>
              </div>
              <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">활동 건수</p>
                <p className="text-2xl font-black text-zinc-900 mt-1">{inlineData.txCount}건</p>
              </div>
              <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">계획 수</p>
                <p className="text-2xl font-black text-zinc-900 mt-1">{inlineData.planProgress.length}개</p>
              </div>
            </div>

            {/* 거래 내역 미리보기 */}
            {inlineData.transactions.length > 0 && (
              <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                    최근 거래 내역 ({inlineData.displayMonth})
                  </h3>
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
                        <td className="px-6 py-3 text-zinc-600">{tx.date}</td>
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

            {/* 평가 요약 (기존 평가가 있을 경우) */}
            {inlineData.existingEvaluation && (
              <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm p-6">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">평가 내용 미리보기</h3>
                {inlineData.existingEvaluation.easy_summary && (
                  <div className="bg-green-50 rounded-xl p-4 mb-3 border border-green-100">
                    <p className="text-xs font-bold text-green-700 mb-1">쉬운 요약</p>
                    <p className="text-sm text-green-900 leading-relaxed">{inlineData.existingEvaluation.easy_summary}</p>
                  </div>
                )}
                {inlineData.existingEvaluation.content && (
                  <p className="text-sm text-zinc-700 leading-relaxed line-clamp-5 whitespace-pre-wrap">
                    {typeof inlineData.existingEvaluation.content === 'string'
                      ? inlineData.existingEvaluation.content
                      : JSON.stringify(inlineData.existingEvaluation.content, null, 2).slice(0, 500)}
                  </p>
                )}
                <Link
                  href={`/supporter/evaluations/${inlineData.participant?.id}/${inlineData.month}`}
                  className="inline-block mt-4 text-xs font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                >
                  평가 전체 보기 / 편집하기 →
                </Link>
              </div>
            )}
          </section>
        )}

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
