import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PreviewClient from './PreviewClient'
import { getSignedImageUrls } from '@/app/actions/storage'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ParticipantPreviewPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 날짜 계산 (쿼리 전에 미리 준비)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
  const remainingDays = totalDaysInMonth - now.getDate() + 1
  const elapsedDays = now.getDate()
  const firstDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`
  const sixMonthsAgo = new Date(year, month - 5, 1).toISOString().split('T')[0]

  // 독립적인 4개 쿼리 병렬 실행 (순차 대기 → 동시 대기)
  const [
    { data: adminProfile },
    { data: participant },
    { data: allParticipants },
    { data: recentTransactions },
  ] = await Promise.all([
    supabase.from('profiles').select('id, role, name').eq('id', user.id).single(),
    supabase.from('participants').select('*, funding_sources(*)').eq('id', id).single(),
    supabase.from('participants').select('id, name').order('name', { ascending: true }),
    supabase.from('transactions').select('*').eq('participant_id', id).order('date', { ascending: false }).limit(3),
  ])

  if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'supporter')) {
    redirect('/')
  }
  if (!participant) redirect('/admin/participants')

  // 이번 달 일별 거래 + 6개월 범위 거래 병렬 실행 (순차 대기 → 동시 대기)
  const [{ data: rawDailyTx }, { data: allMonthTxs }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, date, amount, activity_name, status, receipt_image_url')
      .eq('participant_id', id)
      .gte('date', firstDayOfMonth)
      .lte('date', lastDayOfMonth)
      .order('date', { ascending: true }),
    // N+1 제거: 6번 개별 쿼리 → 1번 범위 쿼리 후 JS 그룹핑
    supabase
      .from('transactions')
      .select('amount, date')
      .eq('participant_id', id)
      .gte('date', sixMonthsAgo)
      .lte('date', lastDayOfMonth),
  ])

  const signedDailyUrls = await getSignedImageUrls(
    (rawDailyTx || []).map((t: any) => ({
      id: t.id,
      receiptUrl: t.receipt_image_url ?? null,
      activityUrl: null,
    }))
  )
  const dailyTransactions = (rawDailyTx || []).map((t: any) => ({
    ...t,
    receipt_image_url: signedDailyUrls[t.id]?.receipt ?? t.receipt_image_url,
  }))

  // 월별 지출 집계 — JS에서 그룹핑 (쿼리 6번 → 1번)
  const totalMonthlyBudget = (participant.funding_sources || []).reduce(
    (acc: number, fs: any) => acc + Number(fs.monthly_budget), 0
  ) || participant.monthly_budget_default || 0

  const monthlyTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthTxs = (allMonthTxs || []).filter((t: any) => t.date.startsWith(m))
    const totalSpent = monthTxs.reduce((sum: number, t: any) => sum + Number(t.amount), 0)
    monthlyTrend.push({ month: m, totalSpent, budget: totalMonthlyBudget })
  }

  return (
    <PreviewClient
      participant={participant}
      allParticipants={allParticipants || []}
      fundingSources={participant.funding_sources || []}
      recentTransactions={recentTransactions || []}
      remainingDays={remainingDays}
      totalDaysInMonth={totalDaysInMonth}
      elapsedDays={elapsedDays}
      dailyTransactions={dailyTransactions || []}
      monthlyTrend={monthlyTrend}
    />
  )
}
