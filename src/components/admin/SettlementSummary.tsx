import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function SettlementSummary() {
  const supabase = await createClient()

  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  const firstDay = `${currentMonth}-01`
  const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]
  const displayMonth = `${now.getFullYear()}년 ${now.getMonth() + 1}월`

  const { data: participants } = await supabase
    .from('participants')
    .select('id, name')
    .order('name')

  if (!participants || participants.length === 0) return null

  const ids = participants.map(p => p.id)

  // 3개 독립 쿼리 병렬 실행 (순차 대기 → 동시 대기)
  // file_links는 테이블이 없을 수 있으므로 .catch()로 개별 처리
  const [
    { data: transactions },
    { data: evaluations },
    { data: files },
  ] = await Promise.all([
    supabase.from('transactions').select('participant_id, status').in('participant_id', ids).gte('date', firstDay).lt('date', nextMonthFirst),
    supabase.from('evaluations').select('participant_id, published_at').in('participant_id', ids).eq('month', currentMonth),
    supabase.from('file_links').select('participant_id').in('participant_id', ids).then(r => r, () => ({ data: null as any[] | null })),
  ])

  const summary = participants.map(p => {
    const ptxs = (transactions || []).filter((t: any) => t.participant_id === p.id)
    const pendingCount = ptxs.filter((t: any) => t.status === 'pending').length
    const totalTxCount = ptxs.length
    const evaluation = (evaluations || []).find((e: any) => e.participant_id === p.id)
    const fileCount = (files || []).filter((f: any) => f.participant_id === p.id).length
    return { ...p, pendingCount, totalTxCount, hasEvaluation: !!evaluation, isPublished: !!evaluation?.published_at, fileCount }
  })

  const allDone = summary.every(p => p.pendingCount === 0 && p.isPublished)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-zinc-900">{displayMonth} 정산 체크리스트</h2>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            {allDone ? '✅ 이번 달 모든 항목이 완료됐습니다.' : '당사자별 처리 현황을 확인하세요.'}
          </p>
        </div>
        <Link
          href="/supporter/transactions"
          className="text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          거래장부 →
        </Link>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
        {/* 컬럼 헤더 */}
        <div className="grid grid-cols-[1fr_140px_100px_80px] px-5 py-3 bg-zinc-50 border-b border-zinc-200">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">당사자</span>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">영수증</span>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">평가</span>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">서류</span>
        </div>

        {summary.map(p => (
          <Link
            key={p.id}
            href={`/admin/participants/${p.id}`}
            className="grid grid-cols-[1fr_140px_100px_80px] px-5 py-3.5 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors items-center"
          >
            <span className="font-bold text-sm text-zinc-800">{p.name}</span>

            {/* 영수증 */}
            <div className="text-center">
              {p.pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-600 text-[11px] font-black">
                  ⏳ {p.pendingCount}건 대기
                </span>
              ) : p.totalTxCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-black">
                  ✅ {p.totalTxCount}건 완료
                </span>
              ) : (
                <span className="text-xs text-zinc-300">내역 없음</span>
              )}
            </div>

            {/* 평가 */}
            <div className="text-center">
              {!p.hasEvaluation ? (
                <span className="text-[11px] font-black text-red-400">미작성</span>
              ) : !p.isPublished ? (
                <span className="text-[11px] font-black text-yellow-500">미발행</span>
              ) : (
                <span className="text-[11px] font-black text-green-600">발행완료</span>
              )}
            </div>

            {/* 서류 */}
            <div className="text-center">
              <span className={`text-[11px] font-black ${p.fileCount > 0 ? 'text-zinc-700' : 'text-zinc-300'}`}>
                {p.fileCount > 0 ? `${p.fileCount}건` : '—'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
