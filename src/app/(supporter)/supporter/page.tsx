import { requireStaff } from '@/utils/supabase/staff'
import Link from 'next/link'
import SupporterQuickTasks from './SupporterQuickTasks'

export const metadata = { title: '대시보드' }

export default async function SupporterPage() {
  const { profile } = await requireStaff()

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">통합 대시보드</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <section className="p-6 rounded-2xl bg-hero text-hero-foreground shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">👋</span>
            <h2 className="text-xl font-black">안녕하세요, {profile.name || '선생님'}님</h2>
          </div>
          <p className="text-sm text-hero-foreground/70 font-medium leading-relaxed">
            서울형 개인예산제 화면을 새로 만드는 중이에요. 담당 당사자 현황을 보고 지원을 이어가요.
          </p>
        </section>
        <Link
          href="/supporter/participants"
          className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-hero text-hero-foreground font-bold text-base hover:bg-hero-hover transition-all active:scale-[0.98] shadow-lg"
        >
          <span className="text-xl">👥</span>
          당사자 목록 보기
        </Link>
        <SupporterQuickTasks />
      </main>
    </div>
  )
}
