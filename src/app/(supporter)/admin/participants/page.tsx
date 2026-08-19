import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminHelpButton from '@/components/help/AdminHelpButton'

interface ParticipantRow {
  id: string
  name: string | null
  email: string | null
  auth_user_id: string | null
  created_at: string
  supporter: { id: string; name: string | null } | null
}

export default async function AdminParticipantsPage() {
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

  // auth_user_id 로 로그인 연결 여부를 함께 보여준다 — 미연결이면 아직 그 이메일로
  // 구글 로그인을 한 적이 없다는 뜻이다 (참여자 본인의 잘못이 아니다).
  const { data: participants } = await supabase
    .from('participants')
    .select(`
      id, name, email, auth_user_id, created_at,
      supporter:profiles!participants_assigned_supporter_id_fkey ( id, name )
    `)
    .order('created_at', { ascending: false })

  const rows = (participants ?? []) as unknown as ParticipantRow[]
  const connectedCount = rows.filter((p) => p.auth_user_id).length

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-zinc-400 hover:text-zinc-600 transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">당사자 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-red-50 rounded-full text-[10px] font-bold text-red-500">관리자</div>
          <AdminHelpButton pageKey="participants" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">등록된 당사자</span>
            <p className="text-3xl font-black text-zinc-900 mt-1">{participants?.length || 0}명</p>
          </div>
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">로그인 연결됨</span>
            <p className="text-3xl font-black text-zinc-900 mt-1">{connectedCount}명</p>
          </div>
        </div>

        <Link
          href="/admin/participants/new"
          className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors active:scale-[0.98] shadow-lg"
        >
          <span className="text-xl">➕</span>
          새 당사자 등록
        </Link>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">당사자 목록</h2>
          {rows.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-50 text-center text-zinc-400 text-sm font-medium">
              아직 등록된 당사자가 없어요.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/participants/${p.id}`}
                    className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900">{p.name}</span>
                      <span className="text-xs text-zinc-400">{p.email}</span>
                      {p.supporter?.name && (
                        <span className="text-[11px] text-zinc-400 mt-0.5">담당: {p.supporter.name}</span>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        p.auth_user_id ? 'bg-green-50 text-green-600' : 'bg-zinc-100 text-zinc-400'
                      }`}
                    >
                      {p.auth_user_id ? '연결됨' : '로그인 대기'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
