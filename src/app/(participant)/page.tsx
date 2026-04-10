import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import HomeDashboard from '@/components/home/HomeDashboard'
import { UIPreferences, DEFAULT_PREFERENCES } from '@/types/ui-preferences'

export default async function Home() {
  // createClient()가 DEMO_MODE=true 시 자동으로 데모 유저와 실제 Supabase 데이터를 반환
  const supabase = await createClient();
  const authData = await supabase.auth.getUser();
  const user = authData.data.user

  if (!user) {
    redirect('/login');
  }

  // 사용자 프로필 및 역할 조회
  const profileData = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  const profile = profileData.data

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
  const participant = participantData.data

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

  // ui_preferences 파싱
  const rawPrefs = participant.ui_preferences as any
  const uiPreferences: UIPreferences | null = rawPrefs?.enabled_blocks
    ? { enabled_blocks: rawPrefs.enabled_blocks }
    : null
  const effectivePrefs = uiPreferences ?? DEFAULT_PREFERENCES

  const recentTxData = await supabase
    .from('transactions')
    .select('*')
    .eq('participant_id', user.id)
    .order('date', { ascending: false })
    .limit(3)
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

  // 최근 6개월 월별 지출 집계 — 쿼리 1번으로 처리
  const totalMonthlyBudget = (participant.funding_sources || []).reduce(
    (acc: number, fs: any) => acc + Number(fs.monthly_budget), 0
  ) || participant.monthly_budget_default || 0

  const sixMonthsAgo = new Date(year, month - 5, 1).toISOString().split('T')[0]
  const { data: allMonthTxs } = await supabase
    .from('transactions')
    .select('amount, date')
    .eq('participant_id', user.id)
    .gte('date', sixMonthsAgo)
    .lte('date', lastDayOfMonth)

  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const totalSpent = (allMonthTxs || [])
      .filter((t: any) => t.date.startsWith(m))
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0)
    monthlyTrend.push({ month: m, totalSpent, budget: totalMonthlyBudget })
  }

  // 지원자 편지 블록이 활성화된 경우에만 최근 평가 조회
  let latestEvaluation: { month: string; tried: string | null; learned: string | null } | null = null
  if (effectivePrefs.enabled_blocks.includes('evaluation_letter')) {
    const { data: evalData } = await supabase
      .from('evaluations')
      .select('month, tried, learned')
      .eq('participant_id', user.id)
      .order('month', { ascending: false })
      .limit(1)
      .single()
    latestEvaluation = evalData
  }

  return (
    <HomeDashboard
      participant={participant}
      participantId={user.id}
      fundingSources={participant.funding_sources || []}
      recentTransactions={recentTransactions || []}
      remainingDays={remainingDays}
      totalDaysInMonth={totalDaysInMonth}
      userName={profile?.name || user.email?.split('@')[0] || ''}
      dailyTransactions={dailyTransactions || []}
      monthlyTrend={monthlyTrend}
      uiPreferences={uiPreferences}
      latestEvaluation={latestEvaluation}
    />
  );
}
