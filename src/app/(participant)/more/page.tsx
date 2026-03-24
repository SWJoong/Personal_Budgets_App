import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MoreMenuClient from '@/components/layout/MoreMenuClient'

export default async function MorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 당사자 정보 및 파일 링크 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: fileLinks } = await supabase
    .from('file_links')
    .select('*')
    .eq('participant_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground pb-24">
      <header className="flex h-16 items-center px-6 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">더보기</h1>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full flex flex-col gap-8">
        {/* 프로필 요약 */}
        <section className="flex items-center gap-4 p-6 rounded-[2rem] bg-white ring-1 ring-zinc-200 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center text-3xl font-black text-zinc-400">
            {profile?.name?.[0] || '👤'}
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-zinc-900">{profile?.name} 님</span>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{profile?.role}</span>
          </div>
        </section>

        {/* 클라이언트 컴포넌트 (설정 및 로그아웃 핸들링) */}
        <MoreMenuClient fileLinks={fileLinks || []} />
        
        <div className="text-center py-4">
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.3em]">아름드리꿈터 개인예산 관리 v1.0</p>
        </div>
      </main>
    </div>
  )
}
