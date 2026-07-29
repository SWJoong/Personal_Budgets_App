import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentParticipant } from '@/utils/supabase/participant'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 역할 조회 — profiles.id = auth.users.id 는 올바른 설계이므로 그대로 둔다.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.role === 'supporter') redirect('/supporter')

  // 참여자 조회 — auth_user_id 경유. participants.id 와 로그인 id 는 다른 값이다.
  const participant = await getCurrentParticipant()

  if (!participant) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <h1 className="text-xl font-bold tracking-tight">서울형 개인예산</h1>
        </header>
        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-6 max-w-sm mx-auto">
          <span className="text-8xl">👋</span>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">반가워요!</h2>
            <p className="text-zinc-500 font-medium leading-relaxed">
              아직 예산 정보가 없어요.<br />지원자 선생님에게 말씀해 주세요.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // 가장 최근(종료일 기준) 예산 배정과 잔액을 함께 조회한다.
  // 잔액은 저장하지 않고 v_seoul_budget_balance 뷰에서 항상 계산한다.
  const { data: balance } = await supabase
    .from('v_seoul_budget_balance')
    .select('*')
    .eq('participant_id', participant.id)
    .order('ends_on', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: recentUsages } = balance
    ? await supabase
        .from('seoul_service_usages')
        .select('id, usage_date, amount, description')
        .eq('allocation_id', balance.allocation_id)
        .order('usage_date', { ascending: false })
        .limit(5)
    : { data: [] as { id: string; usage_date: string; amount: number; description: string | null }[] }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight">{participant.name ?? profile?.name ?? '나'}님의 예산</h1>
      </header>
      <main className="flex-1 p-6 flex flex-col gap-6 max-w-sm mx-auto w-full">
        {!balance ? (
          <section className="p-8 rounded-3xl bg-zinc-100 text-center">
            <p className="text-zinc-500 font-medium leading-relaxed">
              아직 배정된 예산이 없어요.<br />심의가 끝나면 여기에 나와요.
            </p>
          </section>
        ) : (
          <section className="p-8 rounded-3xl bg-zinc-900 text-white flex flex-col gap-2">
            <span className="text-sm font-bold text-zinc-400">지금 쓸 수 있는 돈</span>
            <span className="text-4xl font-black tracking-tight">{won(Number(balance.remaining))}</span>
            <span className="text-xs font-medium text-zinc-400 leading-relaxed">
              전체 {won(Number(balance.total_ceiling))} 중 {won(Number(balance.spent))} 사용했어요
            </span>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-zinc-500">최근 사용한 내역</h2>
          {recentUsages && recentUsages.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {recentUsages.map((u) => (
                <li key={u.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold leading-relaxed">{u.description ?? '활동'}</span>
                    <span className="text-xs text-zinc-400">{u.usage_date}</span>
                  </div>
                  <span className="font-bold">{won(Number(u.amount))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-400 text-sm leading-relaxed">아직 사용한 내역이 없어요.</p>
          )}
        </section>
      </main>
    </div>
  )
}
