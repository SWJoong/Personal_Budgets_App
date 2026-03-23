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
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">거래 및 회계 관리 (장부)</h1>
        <Link
          href="/supporter/transactions/new"
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors"
        >
          + 내역 직접 등록
        </Link>
      </header>

      <main className="w-full max-w-6xl flex flex-col gap-6">
        {/* 요약 컨테이너 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">전체 건수</p>
            <p className="text-3xl font-black text-zinc-900 mt-1">{totalCount}</p>
          </div>
          <div className={`p-5 rounded-xl ring-1 text-center shadow-sm ${pendingCount > 0 ? 'bg-orange-50 ring-orange-200' : 'bg-white ring-zinc-200'}`}>
            <p className="text-xs font-black text-orange-400 uppercase tracking-widest">임시대기 (확인필요)</p>
            <p className={`text-3xl font-black mt-1 ${pendingCount > 0 ? 'text-orange-600' : 'text-zinc-900'}`}>{pendingCount}</p>
          </div>
          <div className="p-5 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-xs font-black text-green-500 uppercase tracking-widest">확정 완료</p>
            <p className="text-3xl font-black text-green-600 mt-1">{confirmedCount}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-lg ring-1 ring-zinc-200 shadow-sm">
          <span className="text-sm font-bold text-zinc-500 ml-2 mr-2">필터:</span>
          <Link
            href="/supporter/transactions"
            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
              !params.status && !params.participant ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >전체보기</Link>
          <div className="w-px h-6 bg-zinc-200 mx-1" />
          <Link
            href="/supporter/transactions?status=pending"
            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
              params.status === 'pending' ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >임시대기</Link>
          <Link
            href="/supporter/transactions?status=confirmed"
            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
              params.status === 'confirmed' ? 'bg-green-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >확정됨</Link>
          <div className="w-px h-6 bg-zinc-200 mx-1" />
          {(participants || []).map((p: any) => (
            <Link
              key={p.id}
              href={`/supporter/transactions?participant=${p.id}`}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
                params.participant === p.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >{p.profiles?.name || '이름없음'}</Link>
          ))}
        </div>

        {/* Data Grid (데이터 테이블) */}
        <div className="bg-white rounded-xl ring-1 ring-zinc-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">거래일자</th>
                  <th className="px-4 py-3">당사자</th>
                  <th className="px-4 py-3">분류</th>
                  <th className="px-4 py-3">활동 내역</th>
                  <th className="px-4 py-3 text-right">금액</th>
                  <th className="px-4 py-3 text-center">결제수단</th>
                  <th className="px-4 py-3">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(!transactions || transactions.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                      <span className="text-4xl mb-3 block">📋</span>
                      조회된 거래 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-zinc-50 transition-colors group">
                      <td className="px-4 py-3">
                        {tx.status === 'confirmed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">확정</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">대기</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{tx.date}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{tx.participant?.profiles?.name || '알 수 없음'}</td>
                      <td className="px-4 py-3 text-zinc-500">{tx.category || '-'}</td>
                      <td className="px-4 py-3 font-bold text-zinc-900">{tx.activity_name}</td>
                      <td className="px-4 py-3 text-right font-black text-zinc-900">{formatCurrency(tx.amount)}원</td>
                      <td className="px-4 py-3 text-center text-zinc-500 text-xs">{tx.payment_method || '-'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/supporter/transactions/${tx.id}`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-bold underline"
                        >
                          상세 및 승인
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
