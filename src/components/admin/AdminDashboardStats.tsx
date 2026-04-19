import { createClient } from '@/utils/supabase/server'
import { formatCurrency } from '@/utils/budget-visuals'

interface ParticipantStat {
  id: string
  name: string
  budget: number
  balance: number
  spent: number
  pct: number
}

export default async function AdminDashboardStats() {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const [{ data: participants }, { data: pendingTxs }] = await Promise.all([
    supabase
      .from('participants')
      .select('id, name, monthly_budget_default, funding_sources(monthly_budget, current_month_balance)')
      .order('name', { ascending: true }),
    supabase
      .from('transactions')
      .select('participant_id')
      .eq('status', 'pending')
      .gte('date', firstDay)
      .lt('date', nextMonth),
  ])

  const pendingCountMap: Record<string, number> = {}
  for (const tx of pendingTxs || []) {
    pendingCountMap[tx.participant_id] = (pendingCountMap[tx.participant_id] || 0) + 1
  }

  const stats: ParticipantStat[] = (participants || []).map((p: any) => {
    const budget =
      p.funding_sources?.reduce((a: number, fs: any) => a + Number(fs.monthly_budget || 0), 0) ||
      Number(p.monthly_budget_default || 0)
    const balance =
      p.funding_sources?.reduce((a: number, fs: any) => a + Number(fs.current_month_balance || 0), 0) || budget
    const spent = Math.max(0, budget - balance)
    const pct = budget > 0 ? Math.round((balance / budget) * 100) : 100
    return { id: p.id, name: p.name || '이름 없음', budget, balance, spent, pct }
  })

  const total = stats.length
  const danger = stats.filter(s => s.pct < 20).length
  const warning = stats.filter(s => s.pct >= 20 && s.pct < 40).length
  const safe = stats.filter(s => s.pct >= 40).length
  const totalBudget = stats.reduce((a, s) => a + s.budget, 0)
  const totalSpent = stats.reduce((a, s) => a + s.spent, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-zinc-800">📊 이번 달 예산 사용 현황</h2>
        <span className="text-xs text-zinc-400 font-bold">{year}년 {month}월</span>
      </div>

      {/* 전체 요약 */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 text-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300">전체 사용률</span>
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
      </div>

      {/* 상태 요약 뱃지 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-50 ring-1 ring-red-100">
          <span className="text-xl">🚨</span>
          <span className="text-2xl font-black text-red-600">{danger}</span>
          <span className="text-[10px] font-bold text-red-400">위험 (20% 미만)</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-50 ring-1 ring-orange-100">
          <span className="text-xl">⚠️</span>
          <span className="text-2xl font-black text-orange-500">{warning}</span>
          <span className="text-[10px] font-bold text-orange-400">주의 (20~40%)</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-50 ring-1 ring-green-100">
          <span className="text-xl">✅</span>
          <span className="text-2xl font-black text-green-600">{safe}</span>
          <span className="text-[10px] font-bold text-green-400">양호 (40% 이상)</span>
        </div>
      </div>

      {/* 당사자별 예산 바 차트 */}
      <div className="rounded-2xl bg-white ring-1 ring-zinc-200 overflow-hidden">
        <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
          <span className="text-xs font-black text-zinc-600">당사자별 잔액 현황</span>
          <span className="text-[10px] text-zinc-400 font-bold">{total}명</span>
        </div>
        <div className="divide-y divide-zinc-100">
          {stats.map(s => {
            const barColor =
              s.pct < 20 ? '#ef4444' : s.pct < 40 ? '#f97316' : '#22c55e'
            const pending = pendingCountMap[s.id] || 0
            return (
              <div key={s.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-zinc-800">{s.name}</span>
                    {pending > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">
                        검토 대기 {pending}건
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-xs font-bold" style={{ color: barColor }}>{s.pct}%</span>
                    <span className="text-xs text-zinc-400 font-medium">
                      {formatCurrency(s.balance)}원 남음
                    </span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${s.pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                  <span>사용 {formatCurrency(s.spent)}원</span>
                  <span>예산 {formatCurrency(s.budget)}원</span>
                </div>
              </div>
            )
          })}
          {stats.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-zinc-400 font-bold">
              등록된 당사자가 없습니다.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
