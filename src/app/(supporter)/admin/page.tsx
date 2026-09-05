import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminHelpButton from '@/components/help/AdminHelpButton'

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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">관리자 대시보드</h1>
        <AdminHelpButton pageKey="dashboard" />
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <section className="p-6 rounded-2xl bg-hero text-hero-foreground shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">👋</span>
            <h2 className="text-xl font-black">안녕하세요, {profile.name || '관리자'}님</h2>
          </div>
          <p className="text-sm text-hero-foreground/70 font-medium">
            등록된 당사자 {participantCount ?? 0}명을 서울형 개인예산제로 지원하고 있어요.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">빠른 실행</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link
              href="/admin/participants/new"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-card ring-1 ring-border hover:ring-foreground hover:bg-muted transition-all shadow-sm active:scale-95"
            >
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">➕</span>
              <span className="text-base font-black text-foreground">당사자 등록</span>
            </Link>
            <Link
              href="/admin/participants"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-card ring-1 ring-border hover:ring-foreground hover:bg-muted transition-all shadow-sm active:scale-95"
            >
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">👥</span>
              <span className="text-base font-black text-foreground">당사자 관리</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
