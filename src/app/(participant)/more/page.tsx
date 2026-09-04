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
    <div className="flex flex-col min-h-dvh bg-muted text-foreground pb-10">
      <HelpAutoTrigger sectionKey="more" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">서울형 개인예산제</span>
          </Link>
          <span className="text-muted-foreground">·</span>
          <h1 className="text-sm font-black text-foreground">⚙ 더보기</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton sectionKey="more" />
          <NavDropdown />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-4 w-full flex flex-col gap-6">
        {/* 프로필 요약 */}
        <section className="flex items-center gap-4 p-6 rounded-[2rem] bg-card ring-1 ring-border shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-3xl font-black text-muted-foreground">
            {profile?.name?.[0] || '👤'}
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-foreground">{profile?.name} 님</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{profile?.role === 'participant' ? '당사자' : profile?.role === 'supporter' ? '지원자' : profile?.role}</span>
          </div>
        </section>

        {/* 화면 설정 — 홈에 무엇을 볼지 고르기(화면 개인화) */}
        <Link
          href="/settings/display"
          className="flex items-center gap-3 p-5 rounded-3xl bg-card ring-1 ring-border shadow-sm hover:bg-muted transition-colors min-h-[44px]"
        >
          <span aria-hidden="true" className="text-2xl">🎛️</span>
          <span className="flex flex-col">
            <span className="font-black text-foreground">화면 설정</span>
            <span className="text-xs text-muted-foreground">홈에 무엇을 볼지 골라요</span>
          </span>
          <span className="ml-auto text-muted-foreground text-xl">›</span>
        </Link>

        {/* 클라이언트 컴포넌트 (설정 및 로그아웃 핸들링) */}
        <MoreMenuClient fileLinks={[]} initialOpenSection={open} />
        
        <div className="text-center py-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">서울형 개인예산제</p>
        </div>
      </main>
    </div>
  )
}
