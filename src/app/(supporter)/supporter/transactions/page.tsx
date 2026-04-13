import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'
import TransactionTableClient from '@/components/transactions/TransactionTableClient'

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: Promise<{
    participant?: string
    status?: string
    category?: string
    paymentMethod?: string
    dateFrom?: string
    dateTo?: string
    sort?: string
    keyword?: string
  }>
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

  // 당사자 목록 (필터용 + 임포트용)
  let participantsQuery = supabase
    .from('participants')
    .select('id, name, funding_sources ( id, name )')

  if (profile.role === 'supporter') {
    participantsQuery = participantsQuery.eq('assigned_supporter_id', user.id)
  }

  const { data: participants } = await participantsQuery

  // 당사자별 재원 맵 (임포트 모달용)
  const participantFundingSources: Record<string, { id: string; name: string }[]> = {}
  for (const p of participants || []) {
    participantFundingSources[(p as any).id] = ((p as any).funding_sources || []).map((fs: any) => ({
      id: fs.id,
      name: fs.name,
    }))
  }

  // 트랜잭션 조회
  let txQuery = supabase
    .from('transactions')
    .select('*, participant:participants!transactions_participant_id_fkey ( name )')

  // 필터 적용
  if (params.participant) {
    txQuery = txQuery.eq('participant_id', params.participant)
  }
  if (params.status) {
    txQuery = txQuery.eq('status', params.status)
  }
  if (params.category) {
    txQuery = txQuery.eq('category', params.category)
  }
  if (params.paymentMethod) {
    txQuery = txQuery.eq('payment_method', params.paymentMethod)
  }
  if (params.dateFrom) {
    txQuery = txQuery.gte('date', params.dateFrom)
  }
  if (params.dateTo) {
    txQuery = txQuery.lte('date', params.dateTo)
  }
  if (params.keyword) {
    txQuery = txQuery.or(`activity_name.ilike.%${params.keyword}%,memo.ilike.%${params.keyword}%`)
  }

  // 정렬
  if (params.sort === 'amount_asc') {
    txQuery = txQuery.order('amount', { ascending: true })
  } else if (params.sort === 'amount_desc') {
    txQuery = txQuery.order('amount', { ascending: false })
  } else {
    txQuery = txQuery.order('date', { ascending: false })
  }

  txQuery = txQuery.limit(100)

  if (profile.role === 'supporter') {
    const myParticipantIds = (participants || []).map((p: any) => p.id)
    if (myParticipantIds.length > 0) {
      txQuery = txQuery.in('participant_id', myParticipantIds)
    }
  }

  const { data: transactions } = await txQuery

  // 지도용 — place 정보 포함된 전체 거래 (필터 무관)
  const { data: allLocatedTx } = await supabase
    .from('transactions')
    .select('id, activity_name, amount, date, status, place_name, place_lat, place_lng, participant:participants!transactions_participant_id_fkey ( name )')
    .not('place_lat', 'is', null)
    .limit(500)

  const mapApiKey = process.env.KAKAO_MAP_API_KEY ?? ''

  // 요약 계산
  const totalCount = transactions?.length || 0
  const pendingCount = transactions?.filter((t: any) => t.status === 'pending').length || 0
  const confirmedCount = transactions?.filter((t: any) => t.status === 'confirmed').length || 0
  const totalAmount = transactions?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

  // 카테고리 목록 추출
  const categories = Array.from(new Set(
    (transactions || []).map((t: any) => t.category).filter(Boolean)
  )) as string[]

  // 결제수단 목록 추출
  const paymentMethods = Array.from(new Set(
    (transactions || []).map((t: any) => t.payment_method).filter(Boolean)
  )) as string[]

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">거래 및 회계 관리 (장부)</h1>
        <Link
          href="/supporter/transactions/new"
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors print:hidden"
        >
          + 내역 직접 등록
        </Link>
      </header>

      <main className="w-full max-w-6xl flex flex-col gap-6">
        {/* 요약 컨테이너 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">전체 건수</p>
            <p className="text-3xl font-black text-zinc-900 mt-1">{totalCount}</p>
          </div>
          <div className={`p-5 rounded-xl ring-1 text-center shadow-sm ${pendingCount > 0 ? 'bg-orange-50 ring-orange-200' : 'bg-white ring-zinc-200'}`}>
            <p className="text-xs font-black text-orange-400 uppercase tracking-widest">임시대기</p>
            <p className={`text-3xl font-black mt-1 ${pendingCount > 0 ? 'text-orange-600' : 'text-zinc-900'}`}>{pendingCount}</p>
          </div>
          <div className="p-5 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-xs font-black text-green-500 uppercase tracking-widest">확정 완료</p>
            <p className="text-3xl font-black text-green-600 mt-1">{confirmedCount}</p>
          </div>
          <div className="p-5 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-xs font-black text-blue-400 uppercase tracking-widest">합계 금액</p>
            <p className="text-2xl font-black text-zinc-900 mt-1">{formatCurrency(totalAmount)}원</p>
          </div>
        </div>

        {/* 클라이언트 컴포넌트로 필터 + 테이블 + 지도 */}
        <TransactionTableClient
          transactions={transactions || []}
          participants={(participants || []).map((p: any) => ({ id: p.id, name: p.name || '이름없음' }))}
          participantFundingSources={participantFundingSources}
          categories={categories}
          paymentMethods={paymentMethods}
          currentFilters={params}
          mapApiKey={mapApiKey}
          mapTransactions={(allLocatedTx || []).map((t: any) => ({
            id: t.id,
            activity_name: t.activity_name,
            amount: t.amount,
            date: t.date,
            status: t.status,
            place_name: t.place_name,
            place_lat: t.place_lat,
            place_lng: t.place_lng,
            participant_name: t.participant?.name,
          }))}
        />
      </main>
    </div>
  )
}
