import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ParticipantDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 관리자 또는 지원자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    redirect('/')
  }

  // 당사자 상세 정보
  const { data: participant } = await supabase
    .from('participants')
    .select(`
      *,
      profiles!participants_id_fkey ( id, name, role ),
      supporter:profiles!participants_assigned_supporter_id_fkey ( id, name ),
      funding_sources ( * )
    `)
    .eq('id', id)
    .single()

  if (!participant) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link href="/admin/participants" className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3">←</Link>
          <h1 className="text-xl font-bold tracking-tight">당사자 정보</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">당사자를 찾을 수 없습니다.</p>
        </main>
      </div>
    )
  }

  // 최근 사용 내역
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('participant_id', id)
    .order('date', { ascending: false })
    .limit(5)

  const fundingSources = participant.funding_sources || []
  const totalMonthlyBudget = fundingSources.reduce((acc: number, fs: any) => acc + Number(fs.monthly_budget), 0)
  const totalMonthBalance = fundingSources.reduce((acc: number, fs: any) => acc + Number(fs.current_month_balance), 0)
  const totalYearBalance = fundingSources.reduce((acc: number, fs: any) => acc + Number(fs.current_year_balance), 0)
  const monthPercentage = totalMonthlyBudget > 0 ? Math.round((totalMonthBalance / totalMonthlyBudget) * 100) : 0

  const backUrl = profile.role === 'admin' ? '/admin/participants' : '/supporter'

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="text-zinc-400 hover:text-zinc-600 transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">{participant.profiles?.name || '당사자'}</h1>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${
          monthPercentage <= 20 ? 'bg-red-50 text-red-500' :
          monthPercentage <= 40 ? 'bg-orange-50 text-orange-500' :
          'bg-zinc-100 text-zinc-500'
        }`}>
          {monthPercentage}% 남음
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 예산 요약 카드 */}
        <section className="p-6 rounded-3xl bg-zinc-900 text-white shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">이번 달 잔액</p>
              <p className="text-4xl font-black mt-1">{formatCurrency(totalMonthBalance)}원</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">올해 잔액</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalYearBalance)}원</p>
            </div>
          </div>
          <div className="h-2 w-full bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                monthPercentage <= 20 ? 'bg-red-500' :
                monthPercentage <= 40 ? 'bg-orange-500' :
                'bg-white'
              }`}
              style={{ width: `${monthPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            <span>0원</span>
            <span>{formatCurrency(totalMonthlyBudget)}원</span>
          </div>
        </section>

        {/* 기본 정보 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">기본 정보</h2>
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-400 text-xs font-medium">운영 기간</span>
                <p className="font-bold text-zinc-800">{participant.budget_start_date} ~ {participant.budget_end_date}</p>
              </div>
              <div>
                <span className="text-zinc-400 text-xs font-medium">담당 지원자</span>
                <p className="font-bold text-zinc-800">{participant.supporter?.name || '미지정'}</p>
              </div>
              <div>
                <span className="text-zinc-400 text-xs font-medium">월 예산 (기본)</span>
                <p className="font-bold text-zinc-800">{formatCurrency(participant.monthly_budget_default)}원</p>
              </div>
              <div>
                <span className="text-zinc-400 text-xs font-medium">경고 기준액</span>
                <p className="font-bold text-zinc-800">{formatCurrency(participant.alert_threshold)}원</p>
              </div>
            </div>
          </div>
        </section>

        {/* 재원 목록 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">재원 ({fundingSources.length}개)</h2>
          {fundingSources.map((fs: any) => {
            const fsPercentage = Number(fs.monthly_budget) > 0 
              ? Math.round((Number(fs.current_month_balance) / Number(fs.monthly_budget)) * 100) 
              : 0
            return (
              <div key={fs.id} className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-zinc-800">{fs.name}</p>
                    <p className="text-xs text-zinc-400">월 {formatCurrency(fs.monthly_budget)}원</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${
                      fsPercentage <= 20 ? 'text-red-600' :
                      fsPercentage <= 40 ? 'text-orange-600' :
                      'text-zinc-900'
                    }`}>{formatCurrency(fs.current_month_balance)}원</p>
                    <p className="text-[10px] text-zinc-400">{fsPercentage}% 남음</p>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      fsPercentage <= 20 ? 'bg-red-500' :
                      fsPercentage <= 40 ? 'bg-orange-500' :
                      'bg-zinc-900'
                    }`}
                    style={{ width: `${fsPercentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </section>

        {/* 최근 사용 내역 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">최근 사용 내역</h2>
          {(!recentTransactions || recentTransactions.length === 0) ? (
            <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 text-center text-zinc-400 text-sm font-medium">
              아직 사용 내역이 없습니다.
            </div>
          ) : (
            recentTransactions.map((tx: any) => (
              <div key={tx.id} className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 flex justify-between items-center">
                <div>
                  <p className="font-bold text-zinc-800 text-sm">{tx.activity_name}</p>
                  <p className="text-xs text-zinc-400">{tx.date} · {tx.category || '미분류'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-zinc-900">{formatCurrency(tx.amount)}원</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    tx.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {tx.status === 'confirmed' ? '확정' : '임시'}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  )
}
