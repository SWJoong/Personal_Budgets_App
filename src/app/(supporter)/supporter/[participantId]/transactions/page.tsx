import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import Link from 'next/link'
import TransactionActions from '@/components/transactions/TransactionActions'
import TransactionFilters from '@/components/transactions/TransactionFilters'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage({
  params,
  searchParams
}: {
  params: Promise<{ participantId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const { participantId } = resolvedParams

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      },
    }
  )

  // Fix lint by defining the expected query return type explicitly 
  const { data: participantData } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', participantId)
    .single() as { data: { name: string } | null }

  // Fetch funding sources for the filters
  const { data: fundingSources } = await supabase
    .from('funding_sources')
    .select('id, name')
    .eq('participant_id', participantId) as { data: { id: string, name: string }[] | null }

  // Apply Filters based on Search Params
  const monthParam = typeof resolvedSearchParams.month === 'string' ? resolvedSearchParams.month : new Date().toISOString().slice(0, 7)
  const sourceIdParam = typeof resolvedSearchParams.sourceId === 'string' ? resolvedSearchParams.sourceId : null
  
  // Date range for the selected month
  const startDate = `${monthParam}-01`
  const nextMonth = new Date(startDate)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const endDate = nextMonth.toISOString().split('T')[0]

  let query = supabase
    .from('transactions')
    .select(`
      id, amount, date, activity_name, category, status,
      funding_sources(name, source_type)
    `)
    .eq('participant_id', participantId)
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date', { ascending: false })

  if (sourceIdParam && sourceIdParam !== 'all') {
    query = query.eq('funding_source_id', sourceIdParam)
  }

  // Type assertion to bypass structural lint errors in the view
  const { data: rawTransactions, error } = await query
  const transactions = rawTransactions as any[]

  if (error) {
    console.error('Error fetching transactions:', error)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {participantData?.name || '당사자'} 회원님의 장부 내역
          </h1>
          <p className="text-gray-500 mt-1">예산 및 개인비용 사용 내역을 관리합니다.</p>
        </div>
        <Link 
          href={`/supporter/${participantId}/transactions/new`}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition"
        >
          새 내역 등록
        </Link>
      </div>

      <TransactionFilters fundingSources={fundingSources || []} />

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600 text-sm">일자</th>
                <th className="p-4 font-semibold text-gray-600 text-sm">활동명(내역)</th>
                <th className="p-4 font-semibold text-gray-600 text-sm">재원</th>
                <th className="p-4 font-semibold text-gray-600 text-sm">분류(카테고리)</th>
                <th className="p-4 font-semibold text-gray-600 text-sm text-right">금액</th>
                <th className="p-4 font-semibold text-gray-600 text-sm text-center">상태</th>
                <th className="p-4 font-semibold text-gray-600 text-sm text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions && transactions.length > 0 ? (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm text-gray-700">
                      {new Date(t.date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="p-4 font-medium text-gray-900">{t.activity_name}</td>
                    <td className="p-4 text-sm text-gray-600">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                        ${(t.funding_sources as any)?.source_type === '예산' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {(t.funding_sources as any)?.name}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">{t.category}</td>
                    <td className="p-4 text-sm font-semibold text-gray-900 text-right">
                      {t.amount >= 0 ? '-' : '+'}{Math.abs(t.amount).toLocaleString()}원
                    </td>
                    <td className="p-4 text-center">
                      {t.status === 'confirmed' ? (
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                           확정됨
                         </span>
                      ) : (
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                           임시저장
                         </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <TransactionActions transactionId={t.id} currentStatus={t.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    아직 등록된 사용 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
