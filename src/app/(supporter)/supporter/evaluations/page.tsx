import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function EvaluationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 지원자 정보 및 담당 당사자 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  let query = supabase
    .from('participants')
    .select(`
      id,
      profiles!participants_id_fkey ( name )
    `)

  if (profile.role === 'supporter') {
    query = query.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await query

  // 현재 월 기준 3개월치 리스트 생성
  const now = new Date()
  const months: { value: string; display: string }[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthStr = d.toISOString().split('T')[0] // YYYY-MM-01
    const displayStr = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    months.push({ value: monthStr, display: displayStr })
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">월별 PCP 평가 관리</h1>
        <p className="text-zinc-500 mt-1">당사자별 활동을 돌아보고 PCP 4+1 형식으로 기록합니다.</p>
      </header>

      <main className="max-w-4xl flex flex-col gap-6">
        <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">당사자 성명</th>
                <th className="px-6 py-4">최근 평가 월</th>
                <th className="px-6 py-4">작성하기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(!participants || participants.length === 0) ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-zinc-400">
                    담당하는 당사자가 없습니다.
                  </td>
                </tr>
              ) : (
                participants.map((p: any) => (
                  <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-600 text-sm">
                          {p.profiles?.name?.[0] || '?'}
                        </div>
                        <span className="font-bold text-zinc-900">{p.profiles?.name || '알 수 없음'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      -
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {months.map(m => (
                          <Link
                            key={m.value}
                            href={`/supporter/evaluations/${p.id}/${m.value}`}
                            className="px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-900 hover:text-white transition-colors"
                          >
                            {m.display}
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
