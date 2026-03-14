import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // MVP: 예산 현황 표시는 하드코딩된 더미 테이터 형태 혹은 준비 중 화면으로 구성
  // 추후 당사자 예산 정보 연동 필요

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight">아름드리꿈터</h1>
        <div className="text-sm text-zinc-500">
          {user.email}
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-8">
        <section className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 relative overflow-hidden">
          <h2 className="text-lg font-semibold z-10 relative text-foreground">이번 달 남은 예산</h2>
          <div className="flex items-end gap-2 z-10 relative">
            <span className="text-4xl font-bold text-primary tracking-tight">150,000</span>
            <span className="text-lg text-zinc-500 font-medium mb-1">원</span>
          </div>
          
          <div className="mt-4 px-3 py-2 bg-positive/10 rounded-lg z-10 relative">
            <p className="text-sm font-medium text-positive">예산이 넉넉합니다. 천천히 계획대로 쓰세요.</p>
          </div>
          
          {/* 장식용 그래픽 요소 */}
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>
          <div className="absolute right-4 bottom-4 text-6xl opacity-20">💰</div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">빠른 실행</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center justify-center p-4 rounded-xl bg-card ring-1 ring-zinc-200 dark:ring-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
              <span className="text-2xl mb-2">📸</span>
              <span className="text-sm font-medium">영수증 올리기</span>
            </button>
            <button className="flex flex-col items-center justify-center p-4 rounded-xl bg-card ring-1 ring-zinc-200 dark:ring-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
              <span className="text-2xl mb-2">🤔</span>
              <span className="text-sm font-medium">오늘 계획 보기</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
