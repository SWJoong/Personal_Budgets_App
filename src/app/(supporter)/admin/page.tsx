import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import AlertPanel from '@/components/admin/AlertPanel'
import AdminHelpButton from '@/components/help/AdminHelpButton'
import AdminParticipantBoard from '@/components/admin/AdminParticipantBoard'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; supporter_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const authData = await supabase.auth.getUser()
  const user = authData.data.user

  if (!user) redirect('/login')

  const profileData = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = profileData.data

  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  const isSuppoterView = params.view === 'supporter'
  const selectedSupporterId = params.supporter_id || ''

  // 실무자 목록 조회 (뷰 토글용)
  const { data: supporters } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('role', 'supporter')
    .order('name', { ascending: true })

  const selectedSupporterName = (supporters || []).find((s: any) => s.id === selectedSupporterId)?.name || ''

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">
          {isSuppoterView ? '실무자 뷰' : '관리자 대시보드'}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
              !isSuppoterView ? 'bg-red-50 text-red-500' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            관리자
          </Link>
          <Link
            href="/admin?view=supporter"
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
              isSuppoterView ? 'bg-blue-50 text-blue-600' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            실무자 뷰
          </Link>
          <Link
            href="/admin/participants"
            className="text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors ml-1"
          >
            전체 →
          </Link>
          <AdminHelpButton pageKey="dashboard" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 실무자 뷰 배너 + 실무자 선택 */}
        {isSuppoterView ? (
          <div className="flex flex-col gap-3 px-4 py-4 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 text-blue-700 text-sm font-bold">
              <span>👁</span>
              <span>실무자 접근 범위 미리보기 — 선택한 실무자의 담당 당사자 데이터만 표시됩니다.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(supporters || []).map((s: any) => (
                <Link
                  key={s.id}
                  href={`/admin?view=supporter&supporter_id=${s.id}`}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    selectedSupporterId === s.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white ring-1 ring-blue-200 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {s.name || s.email}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
            <span className="mt-0.5 text-base">ℹ️</span>
            <span>현재 화면은 관리자 화면입니다. 좌측 하단 로그아웃 시 당사자 화면을 선택해 볼 수 있습니다.</span>
          </div>
        )}

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

        {/* 알림 패널 */}
        <Suspense fallback={
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden animate-pulse">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-200 bg-zinc-100">
              <div className="w-5 h-5 rounded-full bg-zinc-300" />
              <div className="h-4 w-32 bg-zinc-300 rounded" />
            </div>
            <div className="divide-y divide-zinc-100">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-5 h-5 rounded-full bg-zinc-200" />
                  <div className="h-4 w-16 bg-zinc-200 rounded" />
                  <div className="h-4 w-40 bg-zinc-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        }>
          <AlertPanel />
        </Suspense>

        {/* 당사자별 통합 현황 */}
        <Suspense fallback={<div className="rounded-2xl bg-zinc-50 animate-pulse h-64" />}>
          <AdminParticipantBoard />
        </Suspense>

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
