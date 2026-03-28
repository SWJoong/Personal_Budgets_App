import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import HomeDashboard from '@/components/home/HomeDashboard'

export default async function Home() {
  // Demo mode: Skip authentication
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'

  let user = null
  let profile = null
  let participant = null

  if (!isDemoMode) {
    const supabase = await createClient();
    const authData = await supabase.auth.getUser();
    user = authData.data.user

    if (!user) {
      redirect('/login');
    }

    // 사용자 프로필 및 역할 조회
    const profileData = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = profileData.data

    // 관리자/지원자인 경우 전용 페이지로 리다이렉트
    if (profile?.role === 'admin') {
      redirect('/admin');
    }
    if (profile?.role === 'supporter') {
      redirect('/supporter');
    }

    // 당사자 예산 정보 조회
    const participantData = await supabase
      .from('participants')
      .select('*, funding_sources(*)')
      .eq('id', user.id)
      .single();
    participant = participantData.data
  } else {
    // Demo mode: Use dummy data
    user = { id: 'demo-participant', email: 'demo@example.com' }
    profile = {
      id: 'demo-participant',
      name: '김철수',
      role: 'participant',
      email: 'demo@example.com'
    }
    participant = {
      id: 'demo-participant',
      name: '김철수',
      monthly_budget_default: 500000,
      funding_sources: [
        {
          id: 'demo-fs-1',
          name: '개인운영비',
          monthly_budget: 300000,
          balance_current_month: 250000,
          balance_current_year: 2500000
        },
        {
          id: 'demo-fs-2',
          name: '활동지원비',
          monthly_budget: 200000,
          balance_current_month: 150000,
          balance_current_year: 1800000
        }
      ]
    }
  }

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
  let recentTransactions: any[] = []
  let dailyTransactions: any[] = []
  let monthlyTrend: any[] = []

  const firstDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`

  if (!isDemoMode) {
    const supabase = await createClient()

    const recentTxData = await supabase
      .from('transactions')
      .select('*')
      .eq('participant_id', user.id)
      .order('date', { ascending: false })
      .limit(3);
    recentTransactions = recentTxData.data || []

    // 이번 달 일별 거래 내역
    const dailyTxData = await supabase
      .from('transactions')
      .select('date, amount, activity_name, status, receipt_image_url')
      .eq('participant_id', user.id)
      .gte('date', firstDayOfMonth)
      .lte('date', lastDayOfMonth)
      .order('date', { ascending: true })
    dailyTransactions = dailyTxData.data || []

    // 최근 6개월 월별 지출 집계
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
  } else {
    // Demo mode: Use dummy data
    const today = new Date()
    recentTransactions = [
      {
        id: 'demo-tx-1',
        date: today.toISOString().split('T')[0],
        amount: 15000,
        activity_name: '점심 식사',
        category: '식비',
        status: 'confirmed'
      },
      {
        id: 'demo-tx-2',
        date: new Date(today.getTime() - 86400000).toISOString().split('T')[0],
        amount: 35000,
        activity_name: '영화 관람',
        category: '여가활동',
        status: 'confirmed'
      },
      {
        id: 'demo-tx-3',
        date: new Date(today.getTime() - 172800000).toISOString().split('T')[0],
        amount: 8000,
        activity_name: '교통비',
        category: '교통비',
        status: 'pending'
      }
    ]

    dailyTransactions = []

    const totalMonthlyBudget = 500000
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const randomSpent = Math.floor(totalMonthlyBudget * (0.6 + Math.random() * 0.3))
      monthlyTrend.push({
        month: m,
        totalSpent: randomSpent,
        budget: totalMonthlyBudget,
      })
    }
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
