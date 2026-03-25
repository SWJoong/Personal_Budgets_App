import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import HomeDashboard from '@/components/home/HomeDashboard'

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 사용자 프로필 및 역할 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 관리자/지원자인 경우 전용 페이지로 리다이렉트
  if (profile?.role === 'admin') {
    redirect('/admin/participants');
  }
  if (profile?.role === 'supporter') {
    redirect('/supporter');
  }

  // 당사자 예산 정보 조회
  const { data: participant } = await supabase
    .from('participants')
    .select('*, funding_sources(*)')
    .eq('id', user.id)
    .single();

  // 날짜 계산
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = totalDaysInMonth - now.getDate() + 1;
  const elapsedDays = now.getDate();

  // 데이터가 없는 경우 (초기 설정 전)
  if (!participant) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <h1 className="text-xl font-bold tracking-tight">아름드리꿈터</h1>
        </header>
        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-6 max-w-sm mx-auto">
          <span className="text-8xl">👋</span>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">반가워요!</h2>
            <p className="text-zinc-500 font-medium leading-relaxed">
              아직 예산 정보가 등록되지 않았습니다.<br />지원자 선생님께 문의해 주세요.
            </p>
          </div>
          <button className="mt-4 px-8 py-3 bg-zinc-100 text-zinc-500 rounded-xl font-bold pointer-events-none">
            준비 중입니다
          </button>
        </main>
      </div>
    );
  }

  // 최근 사용 내역 조회
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('participant_id', user.id)
    .order('date', { ascending: false })
    .limit(3);

  // 이번 달 일별 거래 내역 (SVG 돈주머니 차트용)
  const firstDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`
  
  const { data: dailyTransactions } = await supabase
    .from('transactions')
    .select('date, amount, activity_name, status, receipt_image_url')
    .eq('participant_id', user.id)
    .gte('date', firstDayOfMonth)
    .lte('date', lastDayOfMonth)
    .order('date', { ascending: true })

  // 최근 6개월 월별 지출 집계 (월별 추이 차트용)
  const monthlyTrend = []
  const totalMonthlyBudget = (participant.funding_sources || []).reduce(
    (acc: number, fs: any) => acc + Number(fs.monthly_budget), 0
  ) || participant.monthly_budget_default || 0

  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mFirst = `${m}-01`
    const mLast = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

    const { data: monthTxs } = await supabase
      .from('transactions')
      .select('amount')
      .eq('participant_id', user.id)
      .gte('date', mFirst)
      .lte('date', mLast)

    const totalSpent = (monthTxs || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0)
    monthlyTrend.push({
      month: m,
      totalSpent,
      budget: totalMonthlyBudget,
    })
  }

  return (
    <HomeDashboard
      profile={profile}
      participant={participant}
      fundingSources={participant.funding_sources || []}
      recentTransactions={recentTransactions || []}
      remainingDays={remainingDays}
      totalDaysInMonth={totalDaysInMonth}
      elapsedDays={elapsedDays}
      userName={profile?.name || user.email?.split('@')[0] || ''}
      dailyTransactions={dailyTransactions || []}
      monthlyTrend={monthlyTrend}
    />
  );
}
