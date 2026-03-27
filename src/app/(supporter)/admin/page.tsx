import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ParticipantPreviewCard from '@/components/admin/ParticipantPreviewCard'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 관리자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  // seed.sql의 첫 4명 참가자 ID
  const targetParticipantIds = [
    '33333333-3333-3333-3333-333333333301', // 김철수
    '33333333-3333-3333-3333-333333333302', // 이영희
    '33333333-3333-3333-3333-333333333303', // 박민수
    '33333333-3333-3333-3333-333333333304', // 정수진
  ]

  // 특정 참가자들의 데이터 조회
  const { data: previewParticipants } = await supabase
    .from('participants')
    .select(`
      *,
      funding_sources (*)
    `)
    .in('id', targetParticipantIds)
    .order('name', { ascending: true })

  // 전체 통계
  const { data: allParticipants } = await supabase
    .from('participants')
    .select('id, monthly_budget_default, funding_sources(monthly_budget, current_month_balance)')

  const totalParticipants = allParticipants?.length || 0
  const totalMonthlyBudget = allParticipants?.reduce((sum, p) => {
    const fsBudget = p.funding_sources?.reduce((acc: number, fs: any) => acc + Number(fs.monthly_budget), 0) || 0
    return sum + (fsBudget || p.monthly_budget_default || 0)
  }, 0) || 0

  const totalMonthlyBalance = allParticipants?.reduce((sum, p) => {
    const fsBalance = p.funding_sources?.reduce((acc: number, fs: any) => acc + Number(fs.current_month_balance), 0) || 0
    return sum + fsBalance
  }, 0) || 0

  const totalMonthlySpent = totalMonthlyBudget - totalMonthlyBalance

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">관리자 대시보드</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/participants"
            className="text-xs font-bold text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            전체 관리
          </Link>
          <div className="px-3 py-1 bg-red-50 rounded-full text-[10px] font-bold text-red-500">관리자</div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 환영 메시지 */}
        <section className="p-6 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">👋</span>
            <h2 className="text-xl font-black">안녕하세요, {profile.name || '관리자'}님</h2>
          </div>
          <p className="text-sm text-zinc-300 font-medium">
            당사자들의 예산 사용 현황을 한눈에 확인하세요.
          </p>
        </section>

        {/* 전체 통계 카드 */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">전체 당사자</span>
            <p className="text-3xl font-black text-zinc-900 mt-1">{totalParticipants}명</p>
          </div>
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">이번 달 전체 예산</span>
            <p className="text-3xl font-black text-blue-600 mt-1">
              {(totalMonthlyBudget / 10000).toFixed(0)}만원
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">이번 달 사용액</span>
            <p className="text-3xl font-black text-orange-600 mt-1">
              {(totalMonthlySpent / 10000).toFixed(0)}만원
            </p>
          </div>
        </section>

        {/* 미리보기 섹션 */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-zinc-900">당사자 화면 미리보기</h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                참가자들이 보는 화면을 미리 확인할 수 있습니다
              </p>
            </div>
            <Link
              href="/admin/participants"
              className="text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              전체 보기 →
            </Link>
          </div>

          {previewParticipants && previewParticipants.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {previewParticipants.map((participant) => (
                <Link key={participant.id} href={`/admin/participants/${participant.id}`}>
                  <ParticipantPreviewCard participant={participant} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-zinc-50 border-2 border-dashed border-zinc-200 text-center">
              <p className="text-sm font-bold text-zinc-400">
                미리보기 대상 참가자가 없습니다.
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                seed.sql을 실행하여 데모 데이터를 생성하세요.
              </p>
            </div>
          )}
        </section>

        {/* 빠른 실행 */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">빠른 실행</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link
              href="/admin/participants/new"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
            >
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">➕</span>
              <span className="text-base font-black text-zinc-800">당사자 등록</span>
            </Link>
            <Link
              href="/admin/participants"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
            >
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">👥</span>
              <span className="text-base font-black text-zinc-800">당사자 관리</span>
            </Link>
            <Link
              href="/admin/settings"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
            >
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">⚙️</span>
              <span className="text-base font-black text-zinc-800">설정</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
