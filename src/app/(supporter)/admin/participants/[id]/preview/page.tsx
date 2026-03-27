import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import HomeDashboard from '@/components/home/HomeDashboard'
import PreviewBanner from '@/components/admin/PreviewBanner'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ParticipantPreviewPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 관리자 또는 지원자 권한 확인
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'supporter')) {
    redirect('/')
  }

  // 해당 당사자 데이터 조회 (participant ID 기반)
  const { data: participant } = await supabase
    .from('participants')
    .select('*, funding_sources(*)')
    .eq('id', id)
    .single()

  if (!participant) redirect('/admin/participants')

  // 미리보기 셀렉터용 전체 당사자 목록
  const { data: allParticipants } = await supabase
    .from('participants')
    .select('id, name')
    .order('name', { ascending: true })

  // 날짜 계산
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
  const remainingDays = totalDaysInMonth - now.getDate() + 1
  const elapsedDays = now.getDate()

  // 최근 사용 내역 조회 (participant ID 기반)
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('participant_id', id)
    .order('date', { ascending: false })
    .limit(3)

  // 이번 달 일별 거래 내역
  const firstDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`

  const { data: dailyTransactions } = await supabase
    .from('transactions')
    .select('date, amount, activity_name, status, receipt_image_url')
    .eq('participant_id', id)
    .gte('date', firstDayOfMonth)
    .lte('date', lastDayOfMonth)
    .order('date', { ascending: true })

  // 최근 6개월 월별 지출 집계
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
      .eq('participant_id', id)
      .gte('date', mFirst)
      .lte('date', mLast)

    const totalSpent = (monthTxs || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0)
    monthlyTrend.push({ month: m, totalSpent, budget: totalMonthlyBudget })
  }

  return (
    <div className="min-h-screen bg-zinc-200 flex flex-col">
      {/* 미리보기 모드 배너 */}
      <PreviewBanner
        currentParticipant={{ id: participant.id, name: participant.name }}
        allParticipants={allParticipants || []}
      />

      {/* 폰 프레임 컨테이너 */}
      <div className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="relative w-full max-w-[390px]">
          {/* 폰 외형 */}
          <div className="relative w-full rounded-[3rem] overflow-hidden shadow-2xl ring-4 ring-zinc-800 bg-white" style={{ minHeight: '844px' }}>
            {/* 노치 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-zinc-800 rounded-b-2xl z-40 pointer-events-none" />

            {/* 실제 당사자 앱 렌더링 */}
            <div className="pt-7">
              <HomeDashboard
                profile={participant}
                participant={participant}
                fundingSources={participant.funding_sources || []}
                recentTransactions={recentTransactions || []}
                remainingDays={remainingDays}
                totalDaysInMonth={totalDaysInMonth}
                elapsedDays={elapsedDays}
                userName={participant.name || ''}
                dailyTransactions={dailyTransactions || []}
                monthlyTrend={monthlyTrend}
              />
            </div>
          </div>

          {/* 홈버튼 */}
          <div className="flex justify-center mt-4">
            <div className="w-32 h-1 bg-zinc-600 rounded-full opacity-60" />
          </div>
        </div>
      </div>
    </div>
  )
}
