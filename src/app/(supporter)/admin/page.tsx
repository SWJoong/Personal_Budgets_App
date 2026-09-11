import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import AdminDashboardCards from './AdminDashboardCards'

export const metadata = { title: '대시보드' }

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  const { count: participantCount } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })

  // 오늘 할 일 카운트 — 각 워크리스트의 pending 필터와 정확히 일치(설계 §상태 카운트).
  // 하나가 실패/null 이어도 대시보드는 떠야 하므로 각 쿼리를 0 으로 폴백하고 병렬 실행한다.
  const [review, screening, planReview] = await Promise.all([
    (async () => {
      try {
        // 검토 대기 = human_decision 'pending' 인 rule_check 의 distinct usage 수(영수증 단위).
        const { data } = await supabase
          .from('seoul_rule_checks')
          .select('usage_id')
          .eq('human_decision', 'pending')
        return new Set((data ?? []).map((r) => r.usage_id)).size
      } catch {
        return 0
      }
    })(),
    (async () => {
      try {
        // 심사 대기 = 접수/심사중 신청 건수.
        const { count } = await supabase
          .from('seoul_applications')
          .select('id', { count: 'exact', head: true })
          .in('status', ['received', 'screening'])
        return count ?? 0
      } catch {
        return 0
      }
    })(),
    (async () => {
      try {
        // 심의 대기 = 제출/검토중 이용계획 건수.
        const { count } = await supabase
          .from('seoul_utilization_plans')
          .select('id', { count: 'exact', head: true })
          .in('status', ['submitted', 'under_review'])
        return count ?? 0
      } catch {
        return 0
      }
    })(),
  ])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">관리자 대시보드</h1>
        <AdminHelpButton pageKey="dashboard" />
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <AdminDashboardCards
          name={profile.name || '관리자'}
          participantCount={participantCount ?? 0}
          pending={{ review, screening, planReview }}
        />
      </main>
    </div>
  )
}
