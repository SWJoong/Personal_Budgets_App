import { createClient } from '@/utils/supabase/server'
import { formatCurrency } from '@/utils/budget-visuals'
import Link from 'next/link'

export default async function AdminParticipantBoard() {
  const supabase = await createClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const currentMonth = `${year}-${String(month).padStart(2, '0')}`
  const firstDay = `${currentMonth}-01`
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  const totalDaysInMonth = new Date(year, month, 0).getDate()
  const remainingDays = totalDaysInMonth - now.getDate() + 1

  const [
    { data: participants },
    { data: transactions },
    { data: evaluations },
    { data: files },
  ] = await Promise.all([
    supabase
      .from('participants')
      .select('id, name, monthly_budget_default, funding_sources(monthly_budget, current_month_balance)')
      .order('name', { ascending: true }),
    supabase
      .from('transactions')
      .select('participant_id, status')
      .gte('date', firstDay)
      .lt('date', nextMonth),
    supabase
      .from('evaluations')
      .select('participant_id, published_at')
      .eq('month', currentMonth),
    supabase
      .from('file_links')
      .select('participant_id')
      .then(r => r, () => ({ data: null as any[] | null })),
  ])

  const rows = (participants || []).map((p: any) => {
    const budget =
      p.funding_sources?.reduce((a: number, fs: any) => a + Number(fs.monthly_budget || 0), 0) ||
      Number(p.monthly_budget_default || 0)
    const balance =
      p.funding_sources?.reduce((a: number, fs: any) => a + Number(fs.current_month_balance || 0), 0) || budget
    const spent = Math.max(0, budget - balance)
    const pct = budget > 0 ? Math.round((balance / budget) * 100) : 100

    const ptxs = (transactions || []).filter((t: any) => t.participant_id === p.id)
    const pendingCount = ptxs.filter((t: any) => t.status === 'pending').length
    const totalTxCount = ptxs.length

    const evaluation = (evaluations || []).find((e: any) => e.participant_id === p.id)
    const fileCount = (files || []).filter((f: any) => f.participant_id === p.id).length

    const barColor = pct < 20 ? '#ef4444' : pct < 40 ? '#f97316' : '#22c55e'

    return {
      id: p.id,
      name: p.name || '이름 없음',
      budget,
      balance,
      spent,
      pct,
      barColor,
      pendingCount,
      totalTxCount,
      hasEvaluation: !!evaluation,
      isPublished: !!evaluation?.published_at,
      fileCount,
    }
  })

  // 전체 요약
  const total = rows.length
  const danger = rows.filter(r => r.pct < 20).length
  const warning = rows.filter(r => r.pct >= 20 && r.pct < 40).length
  const safe = rows.filter(r => r.pct >= 40).length
  const totalBudget = rows.reduce((a, r) => a + r.budget, 0)
  const totalSpent = rows.reduce((a, r) => a + r.spent, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const allSettled = rows.every(r => r.pendingCount === 0 && r.isPublished)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-zinc-800">📋 당사자별 현황</h2>
        <span className="text-xs text-zinc-400 font-bold">{year}년 {month}월 · {total}명</span>
      </div>

      {/* 전체 요약 바 */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 text-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300">전체 예산 사용률</span>
          <span className="text-2xl font-black">{overallPct}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${overallPct}%`,
              background: overallPct > 80 ? '#ef4444' : overallPct > 60 ? '#f97316' : '#22c55e',
            }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-300">
          <span>사용: {formatCurrency(totalSpent)}원</span>
          <span>전체 예산: {formatCurrency(totalBudget)}원</span>
        </div>

        {/* 상태 뱃지 */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-white/10">
            <span className="text-lg">🚨</span>
            <span className="text-xl font-black text-red-300">{danger}</span>
            <span className="text-[10px] font-bold text-red-300/80">위험</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-white/10">
            <span className="text-lg">⚠️</span>
            <span className="text-xl font-black text-orange-300">{warning}</span>
            <span className="text-[10px] font-bold text-orange-300/80">주의</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-white/10">
            <span className="text-lg">✅</span>
            <span className="text-xl font-black text-green-300">{safe}</span>
            <span className="text-[10px] font-bold text-green-300/80">양호</span>
          </div>
        </div>
      </div>

      {/* 당사자별 통합 목록 */}
      <div className="rounded-2xl bg-white ring-1 ring-zinc-200 overflow-hidden">
        {/* 컬럼 헤더 */}
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_90px_64px_32px] px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 gap-2 items-center">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">당사자 · 잔액</span>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center hidden sm:block">영수증</span>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center hidden sm:block">평가</span>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center hidden sm:block">서류</span>
          <span className="hidden sm:block" />
        </div>

        <div className="divide-y divide-zinc-100">
          {rows.map(r => (
            <Link
              key={r.id}
              href={`/admin/participants/${r.id}`}
              className="grid grid-cols-1 sm:grid-cols-[1fr_100px_90px_64px_32px] px-4 py-3.5 gap-2 items-center hover:bg-zinc-50 transition-colors"
            >
              {/* 이름 + 예산 바 */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                      style={{ backgroundColor: r.barColor }}
                    >
                      {r.name.charAt(0)}
                    </div>
                    <span className="text-sm font-black text-zinc-800">{r.name}</span>
                    {r.pendingCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 shrink-0">
                        검토 {r.pendingCount}건
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                    <span style={{ color: r.barColor }}>{r.pct}%</span>
                    <span className="text-zinc-400">{formatCurrency(r.balance)}원</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${r.pct}%`, backgroundColor: r.barColor }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                  <span>사용 {formatCurrency(r.spent)}원 · {remainingDays}일 남음</span>
                  <span>예산 {formatCurrency(r.budget)}원</span>
                </div>

                {/* 모바일: 영수증·평가·서류 인라인 */}
                <div className="flex items-center gap-2 sm:hidden flex-wrap pt-0.5">
                  {r.pendingCount > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">⏳ {r.pendingCount}건 대기</span>
                  ) : r.totalTxCount > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">✅ {r.totalTxCount}건</span>
                  ) : (
                    <span className="text-[10px] text-zinc-300">영수증 없음</span>
                  )}
                  {!r.hasEvaluation ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">평가 미작성</span>
                  ) : !r.isPublished ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">미발행</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">평가 완료</span>
                  )}
                  {r.fileCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">서류 {r.fileCount}건</span>
                  )}
                </div>
              </div>

              {/* 데스크탑: 영수증 */}
              <div className="text-center hidden sm:block">
                {r.pendingCount > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-600 text-[11px] font-black">
                    ⏳ {r.pendingCount}건
                  </span>
                ) : r.totalTxCount > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-black">
                    ✅ {r.totalTxCount}건
                  </span>
                ) : (
                  <span className="text-xs text-zinc-300">—</span>
                )}
              </div>

              {/* 데스크탑: 평가 */}
              <div className="text-center hidden sm:block">
                {!r.hasEvaluation ? (
                  <span className="text-[11px] font-black text-red-400">미작성</span>
                ) : !r.isPublished ? (
                  <span className="text-[11px] font-black text-yellow-500">미발행</span>
                ) : (
                  <span className="text-[11px] font-black text-green-600">발행완료</span>
                )}
              </div>

              {/* 데스크탑: 서류 */}
              <div className="text-center hidden sm:block">
                <span className={`text-[11px] font-black ${r.fileCount > 0 ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  {r.fileCount > 0 ? `${r.fileCount}건` : '—'}
                </span>
              </div>

              {/* 화살표 */}
              <div className="hidden sm:flex justify-center">
                <span className="text-zinc-300 text-xs">→</span>
              </div>
            </Link>
          ))}

          {rows.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-zinc-400 font-bold">
              등록된 당사자가 없습니다.
            </div>
          )}
        </div>

        {/* 하단: 정산 완료 여부 */}
        <div className={`px-5 py-3 border-t border-zinc-100 flex items-center gap-2 ${allSettled ? 'bg-green-50' : 'bg-zinc-50'}`}>
          <span className="text-sm">{allSettled ? '✅' : '⏳'}</span>
          <span className={`text-xs font-bold ${allSettled ? 'text-green-700' : 'text-zinc-500'}`}>
            {allSettled ? `${month}월 모든 당사자 정산 완료` : `${month}월 정산 처리 중`}
          </span>
          <Link
            href="/supporter/transactions"
            className="ml-auto text-[10px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            거래장부 →
          </Link>
        </div>
      </div>
    </section>
  )
}
