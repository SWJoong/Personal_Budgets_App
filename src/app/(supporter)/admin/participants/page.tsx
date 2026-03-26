import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ParticipantsList from '@/components/participants/ParticipantsList'

export default async function AdminParticipantsPage() {
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

  // 당사자 목록 조회 (profiles + participants join)
  const { data: participants } = await supabase
    .from('participants')
    .select(`
      *,
      supporter:profiles!participants_assigned_supporter_id_fkey ( id, name ),
      funding_sources ( id, name, monthly_budget, current_month_balance )
    `)
    .order('created_at', { ascending: false })

  // 전체 프로필 중 아직 당사자 등록이 안 된 사용자 조회
  const { data: allParticipantProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'participant')

  const existingIds = (participants || []).map(p => p.id)
  const unregisteredCount = (allParticipantProfiles || []).filter(p => !existingIds.includes(p.id)).length

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">당사자 관리</h1>
        </div>
        <div className="px-3 py-1 bg-red-50 rounded-full text-[10px] font-bold text-red-500">관리자</div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">등록된 당사자</span>
            <p className="text-3xl font-black text-zinc-900 mt-1">{participants?.length || 0}명</p>
          </div>
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">미등록 사용자</span>
            <p className="text-3xl font-black text-zinc-900 mt-1">{unregisteredCount}</p>
          </div>
        </div>

        {/* 새 당사자 등록 버튼 */}
        <Link 
          href="/admin/participants/new"
          className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors active:scale-[0.98] shadow-lg"
        >
          <span className="text-xl">➕</span>
          새 당사자 등록
        </Link>

        {/* 당사자 목록 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">당사자 목록</h2>
          <ParticipantsList participants={participants || []} />
        </section>
      </main>
    </div>
  )
}
