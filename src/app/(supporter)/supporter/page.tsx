import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'

export default async function SupporterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 지원자 또는 관리자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  // 담당 당사자 조회 (지원자는 자기에게 배정된 당사자만, 관리자는 전체)
  let query = supabase
    .from('participants')
    .select(`
      *,
      funding_sources ( id, name, monthly_budget, current_month_balance, current_year_balance )
    `)

  if (profile.role === 'supporter') {
    query = query.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await query.order('created_at', { ascending: false })

  // 오늘 날짜 기준 확인할 항목 수 (임시 반영 사용 내역)
  const participantIds = (participants || []).map((p: any) => p.id)
  let pendingCount = 0
  if (participantIds.length > 0) {
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .in('participant_id', participantIds)
      .eq('status', 'pending')
    pendingCount = count || 0
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">통합 대시보드</h1>
        <div className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-bold text-zinc-700">
          {profile.name || '지원자'} 담당
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col gap-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">담당 인원</span>
            <p className="text-3xl font-black text-zinc-900 mt-1">{participants?.length || 0}명</p>
          </div>
          <div className={`p-5 rounded-2xl ring-1 shadow-sm ${
            pendingCount > 0 
              ? 'bg-orange-50 ring-orange-200' 
              : 'bg-white ring-zinc-200'
          }`}>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">확인 대기</span>
            <p className={`text-3xl font-black mt-1 ${
              pendingCount > 0 ? 'text-orange-600' : 'text-zinc-900'
            }`}>{pendingCount}건</p>
          </div>
        </div>

        {/* 당사자 목록 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">당사자 목록</h2>

          {(!participants || participants.length === 0) ? (
            <div className="p-8 rounded-2xl bg-zinc-50 border border-zinc-200 text-center">
              <span className="text-5xl mb-3 block">📋</span>
              <p className="text-zinc-500 font-medium">배정된 당사자가 없습니다.</p>
              <p className="text-zinc-400 text-sm mt-1">관리자에게 문의해 주세요.</p>
            </div>
          ) : (
            participants.map((p: any) => {
              const fsList = p.funding_sources || []
              const totalBalance = fsList.reduce((acc: number, fs: any) => acc + Number(fs.current_month_balance), 0)
              const totalBudget = fsList.reduce((acc: number, fs: any) => acc + Number(fs.monthly_budget), 0)
              const percentage = totalBudget > 0 ? Math.round((totalBalance / totalBudget) * 100) : 0

              return (
                <Link
                  key={p.id}
                  href={`/admin/participants/${p.id}`}
                  className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all shadow-sm group active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-xl font-bold text-zinc-600">
                        {(p.name || '?')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800 text-lg">{p.name || '이름 없음'}</p>
                        <p className="text-xs text-zinc-400">재원 {fsList.length}개</p>
                      </div>
                    </div>
                    <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors text-lg">→</span>
                  </div>

                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">이번 달 잔액</p>
                      <p className={`text-xl font-black ${
                        percentage <= 20 ? 'text-red-600' :
                        percentage <= 40 ? 'text-orange-600' :
                        'text-zinc-900'
                      }`}>{formatCurrency(totalBalance)}원</p>
                    </div>
                    <p className="text-xs text-zinc-400 font-bold">{percentage}%</p>
                  </div>

                  <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        percentage <= 20 ? 'bg-red-500' :
                        percentage <= 40 ? 'bg-orange-500' :
                        'bg-zinc-900'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </Link>
              )
            })
          )}
        </section>
      </main>
    </div>
  )
}
