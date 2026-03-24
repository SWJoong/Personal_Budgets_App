import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
      profiles!participants_id_fkey ( id, name, role ),
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
          
          {(!participants || participants.length === 0) ? (
            <div className="p-8 rounded-2xl bg-zinc-50 border border-zinc-200 text-center">
              <span className="text-5xl mb-3 block">📋</span>
              <p className="text-zinc-500 font-medium">아직 등록된 당사자가 없습니다.</p>
              <p className="text-zinc-400 text-sm mt-1">위의 버튼을 눌러 당사자를 등록하세요.</p>
            </div>
          ) : (
            participants.map((p: any) => {
              const totalBalance = (p.funding_sources || []).reduce(
                (acc: number, fs: any) => acc + Number(fs.current_month_balance), 0
              )
              const totalBudget = (p.funding_sources || []).reduce(
                (acc: number, fs: any) => acc + Number(fs.monthly_budget), 0
              )
              const percentage = totalBudget > 0 ? Math.round((totalBalance / totalBudget) * 100) : 0

              return (
                <div 
                  key={p.id} 
                  className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-lg font-bold text-zinc-600">
                        {(p.profiles?.name || '?')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800">{p.profiles?.name || '이름 없음'}</p>
                        <p className="text-xs text-zinc-400">
                          재원 {p.funding_sources?.length || 0}개 · 
                          담당: {p.supporter?.name || '미지정'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${
                        percentage <= 20 ? 'text-red-600' : 
                        percentage <= 40 ? 'text-orange-600' : 'text-zinc-900'
                      }`}>{percentage}%</p>
                      <p className="text-[10px] text-zinc-400">이번 달</p>
                    </div>
                  </div>
                  
                  {/* 게이지 바 */}
                  <div className="mt-4 h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        percentage <= 20 ? 'bg-red-500' : 
                        percentage <= 40 ? 'bg-orange-500' : 'bg-zinc-900'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* 액션 버튼 */}
                  <div className="mt-5 pt-4 border-t border-zinc-50 flex gap-2">
                    <Link 
                      href={`/admin/participants/${p.id}`}
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 text-zinc-600 text-xs font-black text-center hover:bg-zinc-100 transition-all"
                    >
                      상세 설정 보기
                    </Link>
                    <Link 
                      href={`/?simulate=${p.id}`}
                      className="flex-1 px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-black text-center hover:bg-blue-100 transition-all"
                    >
                      당사자 화면 보기
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </section>
      </main>
    </div>
  )
}
