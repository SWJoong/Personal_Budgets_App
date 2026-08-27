import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MoreMenuClient from '@/components/layout/MoreMenuClient'
import NavDropdown from '@/components/layout/NavDropdown'
import HelpButton from '@/components/help/HelpButton'
import HelpAutoTrigger from '@/components/help/HelpAutoTrigger'

export const metadata = { title: '더보기' }

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>
}) {
  const { open } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 당사자 정보 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <HelpAutoTrigger sectionKey="more" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">아름드리꿈터</span>
          </Link>
          <span className="text-zinc-300">·</span>
          <h1 className="text-sm font-black text-zinc-800">⚙ 더보기</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton sectionKey="more" />
          <NavDropdown />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-4 w-full flex flex-col gap-6">
        {/* 프로필 요약 */}
        <section className="flex items-center gap-4 p-6 rounded-[2rem] bg-white ring-1 ring-zinc-200 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center text-3xl font-black text-zinc-400">
            {profile?.name?.[0] || '👤'}
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-zinc-900">{profile?.name} 님</span>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{profile?.role === 'participant' ? '당사자' : profile?.role === 'supporter' ? '지원자' : profile?.role}</span>
          </div>
        </section>

        {/* 화면 설정 — 홈에 무엇을 볼지 고르기(화면 개인화) */}
        <Link
          href="/settings/display"
          className="flex items-center gap-3 p-5 rounded-3xl bg-white ring-1 ring-zinc-200 shadow-sm hover:bg-zinc-50 transition-colors min-h-[44px]"
        >
          <span aria-hidden="true" className="text-2xl">🎛️</span>
          <span className="flex flex-col">
            <span className="font-black text-zinc-900">화면 설정</span>
            <span className="text-xs text-zinc-400">홈에 무엇을 볼지 골라요</span>
          </span>
          <span className="ml-auto text-zinc-300 text-xl">›</span>
        </Link>

        {/* 클라이언트 컴포넌트 (설정 및 로그아웃 핸들링) */}
        <MoreMenuClient fileLinks={[]} initialOpenSection={open} />
        
        <div className="text-center py-4">
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.3em]">아름드리꿈터 개인예산</p>
        </div>
      </main>
    </div>
  )
}
