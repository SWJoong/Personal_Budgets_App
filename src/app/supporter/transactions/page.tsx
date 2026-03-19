import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: Promise<{ participant?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  // 당사자 목록 (필터용)
  let participantsQuery = supabase
    .from('participants')
    .select('id, profiles!participants_id_fkey ( name )')

  if (profile.role === 'supporter') {
    participantsQuery = participantsQuery.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await participantsQuery

  // 트랜잭션 조회
  let txQuery = supabase
    .from('transactions')
    .select('*, participant:participants!transactions_participant_id_fkey ( profiles!participants_id_fkey ( name ) )')
    .order('date', { ascending: false })
    .limit(50)

  if (params.participant) {
    txQuery = txQuery.eq('participant_id', params.participant)
  }
  if (params.status) {
    txQuery = txQuery.eq('status', params.status)
  }
  if (profile.role === 'supporter') {
    const myParticipantIds = (participants || []).map((p: any) => p.id)
    if (myParticipantIds.length > 0) {
      txQuery = txQuery.in('participant_id', myParticipantIds)
    }
  }

  const { data: transactions } = await txQuery

  // 요약 계산
  const totalCount = transactions?.length || 0
  const pendingCount = transactions?.filter((t: any) => t.status === 'pending').length || 0
  const confirmedCount = transactions?.filter((t: any) => t.status === 'confirmed').length || 0

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href={profile.role === 'admin' ? '/admin/participants' : '/supporter'} className="text-zinc-400 hover:text-zinc-600 transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">사용 내역</h1>
        </div>
        <Link
          href="/supporter/transactions/new"
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-xl hover:bg-zinc-800 transition-colors"
        >
          + 등록
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* 요약 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">전체</p>
            <p className="text-2xl font-black text-zinc-900 mt-0.5">{totalCount}</p>
          </div>
          <div className={`p-4 rounded-xl ring-1 text-center shadow-sm ${pendingCount > 0 ? 'bg-orange-50 ring-orange-200' : 'bg-white ring-zinc-200'}`}>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">임시</p>
            <p className={`text-2xl font-black mt-0.5 ${pendingCount > 0 ? 'text-orange-600' : 'text-zinc-900'}`}>{pendingCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">확정</p>
            <p className="text-2xl font-black text-green-600 mt-0.5">{confirmedCount}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href="/supporter/transactions"
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              !params.status && !params.participant ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >전체</Link>
          <Link
            href="/supporter/transactions?status=pending"
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              params.status === 'pending' ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >임시 반영</Link>
          <Link
            href="/supporter/transactions?status=confirmed"
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              params.status === 'confirmed' ? 'bg-green-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >확정</Link>
          {(participants || []).map((p: any) => (
            <Link
              key={p.id}
              href={`/supporter/transactions?participant=${p.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                params.participant === p.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >{p.profiles?.name || '이름없음'}</Link>
          ))}
        </div>

        {/* 내역 목록 */}
        <section className="flex flex-col gap-2">
          {(!transactions || transactions.length === 0) ? (
            <div className="p-8 rounded-2xl bg-zinc-50 border border-zinc-200 text-center">
              <span className="text-4xl mb-2 block">📋</span>
              <p className="text-zinc-500 font-medium">사용 내역이 없습니다.</p>
            </div>
          ) : (
            transactions.map((tx: any) => (
              <Link
                key={tx.id}
                href={`/supporter/transactions/${tx.id}`}
                className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all flex justify-between items-center active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    tx.status === 'confirmed' ? 'bg-green-500' : 'bg-orange-400'
                  }`} />
                  <div>
                    <p className="font-bold text-zinc-800 text-sm">{tx.activity_name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {tx.date} · {tx.participant?.profiles?.name || '알 수 없음'} · {tx.category || '미분류'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="font-black text-zinc-900">{formatCurrency(tx.amount)}원</p>
                  <span className={`text-[10px] font-bold ${
                    tx.status === 'confirmed' ? 'text-green-600' : 'text-orange-500'
                  }`}>
                    {tx.status === 'confirmed' ? '확정' : '임시'}
                  </span>
                </div>
              </Link>
            ))
          )}
        </section>
      </main>
    </div>
  )
}
