'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteParticipant } from '@/app/actions/admin'
import { formatCurrency } from '@/utils/budget-visuals'

interface ParticipantDetailClientProps {
  participant: any
  fundingSources: any[]
  recentTransactions: any[]
  monthPercentage: number
  totalMonthBalance: number
  totalYearBalance: number
  totalMonthlyBudget: number
  backUrl: string
}

export default function ParticipantDetailClient({
  participant,
  fundingSources,
  recentTransactions,
  monthPercentage,
  totalMonthBalance,
  totalYearBalance,
  totalMonthlyBudget,
  backUrl,
}: ParticipantDetailClientProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    const confirmed = confirm(
      `정말로 "${participant.name}" 당사자를 삭제하시겠습니까?\n\n관련된 모든 거래 내역, 계획, 평가, 재원 데이터가 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await deleteParticipant(participant.id)
      if (result.error) {
        alert(`삭제 실패: ${result.error}`)
        setIsDeleting(false)
      } else {
        alert('삭제되었습니다.')
        router.push('/admin/participants')
        router.refresh()
      }
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.')
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="text-zinc-400 hover:text-zinc-600 transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">{participant.name || '당사자'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/participants/${participant.id}/report`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            <span>🖨️</span>
            <span>월간 보고서</span>
          </Link>
          <Link
            href={`/admin/participants/${participant.id}/preview`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
          >
            <span>👁</span>
            <span>앱 미리보기</span>
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <span>🗑</span>
            <span>{isDeleting ? '삭제 중...' : '삭제'}</span>
          </button>
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${
            monthPercentage <= 20 ? 'bg-red-50 text-red-500' :
            monthPercentage <= 40 ? 'bg-orange-50 text-orange-500' :
            'bg-zinc-100 text-zinc-500'
          }`}>
            {monthPercentage}% 남음
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 예산 요약 카드 */}
        <section className="p-6 rounded-3xl bg-zinc-900 text-white shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">이번 달 잔액</p>
              <p className="text-4xl font-black mt-1">{formatCurrency(totalMonthBalance)}원</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">올해 잔액</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalYearBalance)}원</p>
            </div>
          </div>
          <div className="h-2 w-full bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                monthPercentage <= 20 ? 'bg-red-500' :
                monthPercentage <= 40 ? 'bg-orange-500' :
                'bg-white'
              }`}
              style={{ width: `${monthPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            <span>0원</span>
            <span>{formatCurrency(totalMonthlyBudget)}원</span>
          </div>
        </section>

        {/* 기본 정보 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">기본 정보</h2>
          <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-400 text-xs font-medium">운영 기간</span>
                <p className="font-bold text-zinc-800">{participant.budget_start_date} ~ {participant.budget_end_date}</p>
              </div>
              <div>
                <span className="text-zinc-400 text-xs font-medium">담당 지원자</span>
                <p className="font-bold text-zinc-800">{participant.supporter?.name || '미지정'}</p>
              </div>
              <div>
                <span className="text-zinc-400 text-xs font-medium">월 예산 (기본)</span>
                <p className="font-bold text-zinc-800">{formatCurrency(participant.monthly_budget_default)}원</p>
              </div>
              <div>
                <span className="text-zinc-400 text-xs font-medium">경고 기준액</span>
                <p className="font-bold text-zinc-800">{formatCurrency(participant.alert_threshold)}원</p>
              </div>
            </div>
          </div>
        </section>

        {/* 재원 목록 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">재원 ({fundingSources.length}개)</h2>
          {fundingSources.map((fs: any) => {
            const fsPercentage = Number(fs.monthly_budget) > 0
              ? Math.round((Number(fs.current_month_balance) / Number(fs.monthly_budget)) * 100)
              : 0
            return (
              <div key={fs.id} className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-zinc-800">{fs.name}</p>
                    <p className="text-xs text-zinc-400">월 {formatCurrency(fs.monthly_budget)}원</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${
                      fsPercentage <= 20 ? 'text-red-600' :
                      fsPercentage <= 40 ? 'text-orange-600' :
                      'text-zinc-900'
                    }`}>{formatCurrency(fs.current_month_balance)}원</p>
                    <p className="text-[10px] text-zinc-400">{fsPercentage}% 남음</p>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      fsPercentage <= 20 ? 'bg-red-500' :
                      fsPercentage <= 40 ? 'bg-orange-500' :
                      'bg-zinc-900'
                    }`}
                    style={{ width: `${fsPercentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </section>

        {/* 빠른 이동 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">빠른 이동</h2>
          <div className="grid grid-cols-3 gap-3">
            <Link
              href={`/supporter/transactions?participant=${participant.id}`}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm hover:ring-zinc-900 transition-all active:scale-[0.97] group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📒</span>
              <span className="text-xs font-black text-zinc-700 text-center">거래 장부</span>
            </Link>
            <Link
              href={`/supporter/evaluations?participant_id=${participant.id}`}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm hover:ring-zinc-900 transition-all active:scale-[0.97] group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📝</span>
              <span className="text-xs font-black text-zinc-700 text-center">계획과 평가</span>
            </Link>
            <Link
              href={`/supporter/documents?participant_id=${participant.id}`}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm hover:ring-zinc-900 transition-all active:scale-[0.97] group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📁</span>
              <span className="text-xs font-black text-zinc-700 text-center">증빙 서류</span>
            </Link>
          </div>
        </section>

        {/* 최근 사용 내역 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">최근 사용 내역</h2>
          {(!recentTransactions || recentTransactions.length === 0) ? (
            <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 text-center text-zinc-400 text-sm font-medium">
              아직 사용 내역이 없습니다.
            </div>
          ) : (
            recentTransactions.map((tx: any) => (
              <Link key={tx.id} href={`/supporter/transactions/${tx.id}`} className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 flex justify-between items-center hover:ring-zinc-400 transition-colors active:scale-[0.99]">
                <div>
                  <p className="font-bold text-zinc-800 text-sm">{tx.activity_name}</p>
                  <p className="text-xs text-zinc-400">{tx.date} · {tx.category || '미분류'}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="font-bold text-zinc-900">{formatCurrency(tx.amount)}원</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    tx.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
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
