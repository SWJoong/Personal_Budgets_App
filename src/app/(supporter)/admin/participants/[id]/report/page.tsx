import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/utils/budget-visuals'
import PrintButton from './PrintButton'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function ParticipantReportPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { month } = await searchParams
  const targetMonth = month || getCurrentMonth()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) redirect('/')

  const { data: participant } = await supabase
    .from('participants')
    .select('*, supporter:profiles!participants_assigned_supporter_id_fkey(id, name), funding_sources(*)')
    .eq('id', id)
    .single()

  if (!participant) redirect('/admin/participants')

  const [year, mon] = targetMonth.split('-').map(Number)
  const startDate = `${targetMonth}-01`
  const endDate = new Date(year, mon, 1).toISOString().split('T')[0]

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, date, activity_name, amount, status, category, payment_method, memo')
    .eq('participant_id', id)
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date', { ascending: true })

  const txList = transactions || []
  const fundingSources = (participant.funding_sources as any[]) || []

  const totalMonthlyBudget = fundingSources.reduce((acc, fs) => acc + Number(fs.monthly_budget), 0)
  const totalBalance = fundingSources.reduce((acc, fs) => acc + Number(fs.current_month_balance), 0)
  const totalSpent = txList.reduce((acc, tx: any) => acc + Number(tx.amount), 0)
  const confirmedSpent = txList
    .filter((tx: any) => tx.status === 'confirmed')
    .reduce((acc, tx: any) => acc + Number(tx.amount), 0)

  const monthLabel = `${year}년 ${mon}월`
  const today = new Date().toLocaleDateString('ko-KR')

  return (
    <div className="min-h-screen bg-white p-6 sm:p-10 print-area">
      {/* 화면 전용 상단 버튼 */}
      <div className="flex items-center gap-3 mb-8 print:hidden">
        <Link
          href={`/admin/participants/${id}`}
          className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
        >
          ← 당사자 상세
        </Link>
        <span className="text-zinc-200">|</span>
        <PrintButton />
      </div>

      {/* 보고서 헤더 */}
      <div className="mb-8 pb-6 border-b-2 border-zinc-900">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">월간 예산 보고서</p>
        <h1 className="text-3xl font-black text-zinc-900">{(participant as any).name} — {monthLabel}</h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-zinc-500 font-medium">
          <span>생성일: {today}</span>
          <span>재원: {fundingSources.map((fs: any) => fs.source_name).join(', ') || '미설정'}</span>
          <span>담당 실무자: {(participant as any).supporter?.name || '미배정'}</span>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl ring-1 ring-zinc-200 print:ring-1 print:rounded-none print:border print:border-zinc-300">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">이번 달 예산</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{formatCurrency(totalMonthlyBudget)}원</p>
        </div>
        <div className="p-5 rounded-2xl ring-1 ring-zinc-200 print:ring-1 print:rounded-none print:border print:border-zinc-300">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">사용액 (확정)</p>
          <p className="text-2xl font-black text-orange-600 mt-1">{formatCurrency(confirmedSpent)}원</p>
        </div>
        <div className="p-5 rounded-2xl ring-1 ring-zinc-200 print:ring-1 print:rounded-none print:border print:border-zinc-300">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">잔여 예산</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{formatCurrency(totalBalance)}원</p>
        </div>
      </div>

      {/* 재원별 현황 */}
      {fundingSources.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-black text-zinc-900 mb-3 pb-2 border-b border-zinc-200">재원별 현황</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-50">
                <th className="text-left px-3 py-2 border border-zinc-200 font-bold text-zinc-600">재원명</th>
                <th className="text-right px-3 py-2 border border-zinc-200 font-bold text-zinc-600">이번 달 예산</th>
                <th className="text-right px-3 py-2 border border-zinc-200 font-bold text-zinc-600">현재 잔액</th>
                <th className="text-right px-3 py-2 border border-zinc-200 font-bold text-zinc-600">사용액</th>
                <th className="text-right px-3 py-2 border border-zinc-200 font-bold text-zinc-600">소진율</th>
              </tr>
            </thead>
            <tbody>
              {fundingSources.map((fs: any) => {
                const budget = Number(fs.monthly_budget)
                const balance = Number(fs.current_month_balance)
                const spent = budget - balance
                const ratio = budget > 0 ? Math.round((spent / budget) * 100) : 0
                return (
                  <tr key={fs.id}>
                    <td className="px-3 py-2 border border-zinc-200 font-medium">{fs.source_name}</td>
                    <td className="px-3 py-2 border border-zinc-200 text-right">{formatCurrency(budget)}원</td>
                    <td className="px-3 py-2 border border-zinc-200 text-right">{formatCurrency(balance)}원</td>
                    <td className="px-3 py-2 border border-zinc-200 text-right font-bold text-orange-600">{formatCurrency(spent)}원</td>
                    <td className="px-3 py-2 border border-zinc-200 text-right">{ratio}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* 거래 내역 */}
      <section>
        <h2 className="text-base font-black text-zinc-900 mb-3 pb-2 border-b border-zinc-200">
          거래 내역 ({txList.length}건 · 합계 {formatCurrency(totalSpent)}원)
        </h2>
        {txList.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4">이번 달 거래 내역이 없습니다.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-50">
                <th className="text-left px-3 py-2 border border-zinc-200 font-bold text-zinc-600 w-24">날짜</th>
                <th className="text-left px-3 py-2 border border-zinc-200 font-bold text-zinc-600 w-16">상태</th>
                <th className="text-left px-3 py-2 border border-zinc-200 font-bold text-zinc-600">활동명</th>
                <th className="text-left px-3 py-2 border border-zinc-200 font-bold text-zinc-600 w-24">분류</th>
                <th className="text-right px-3 py-2 border border-zinc-200 font-bold text-zinc-600 w-28">금액</th>
                <th className="text-left px-3 py-2 border border-zinc-200 font-bold text-zinc-600 w-24">결제수단</th>
                <th className="text-left px-3 py-2 border border-zinc-200 font-bold text-zinc-600">메모</th>
              </tr>
            </thead>
            <tbody>
              {txList.map((tx: any) => (
                <tr key={tx.id} className="even:bg-zinc-50">
                  <td className="px-3 py-2 border border-zinc-200 text-zinc-600">{tx.date}</td>
                  <td className="px-3 py-2 border border-zinc-200">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      tx.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {tx.status === 'confirmed' ? '확정' : '대기'}
                    </span>
                  </td>
                  <td className="px-3 py-2 border border-zinc-200 font-medium">{tx.activity_name}</td>
                  <td className="px-3 py-2 border border-zinc-200 text-zinc-500">{tx.category || '-'}</td>
                  <td className="px-3 py-2 border border-zinc-200 text-right font-black text-zinc-900">{formatCurrency(tx.amount)}원</td>
                  <td className="px-3 py-2 border border-zinc-200 text-zinc-500">{tx.payment_method || '-'}</td>
                  <td className="px-3 py-2 border border-zinc-200 text-zinc-400 text-xs">{tx.memo || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
