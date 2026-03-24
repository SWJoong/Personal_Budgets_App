'use client'

import { useState } from 'react'
import { formatCurrency, getBudgetVisualInfo } from '@/utils/budget-visuals'
import Link from 'next/link'

interface FundingSource {
  id: string
  name: string
  monthly_budget: number
  yearly_budget: number
  current_month_balance: number
  current_year_balance: number
}

interface HomeDashboardProps {
  profile: any
  participant: any
  fundingSources: FundingSource[]
  recentTransactions: any[]
  remainingDays: number
  totalDaysInMonth: number
  elapsedDays: number
  userName: string
}

type ViewMode = 'total' | 'source'

export default function HomeDashboard({
  profile, participant, fundingSources, recentTransactions,
  remainingDays, totalDaysInMonth, elapsedDays, userName
}: HomeDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('total')

  // 통합 계산
  const totalMonthlyBudget = fundingSources.reduce((acc, fs) => acc + Number(fs.monthly_budget), 0) || participant.monthly_budget_default
  const totalMonthBalance = fundingSources.reduce((acc, fs) => acc + Number(fs.current_month_balance), 0)
  const totalYearBalance = fundingSources.reduce((acc, fs) => acc + Number(fs.current_year_balance), 0)
  const totalYearlyBudget = fundingSources.reduce((acc, fs) => acc + Number(fs.yearly_budget), 0) || participant.yearly_budget_default

  const visual = getBudgetVisualInfo(totalMonthBalance, totalMonthlyBudget, remainingDays, totalDaysInMonth)

  // 속도 계산: 하루 평균 사용액 vs 남은 일수 대비 적정 사용액
  const spent = totalMonthlyBudget - totalMonthBalance
  const dailyAvgSpent = elapsedDays > 0 ? spent / elapsedDays : 0
  const idealDailySpend = totalMonthlyBudget / totalDaysInMonth

  let speedMessage = ''
  if (spent === 0) {
    speedMessage = '아직 이번 달에 사용한 내역이 없습니다.'
  } else if (dailyAvgSpent <= idealDailySpend * 0.8) {
    speedMessage = `이번 달 남은 날짜에 비해 예산이 여유 있습니다.`
  } else if (dailyAvgSpent <= idealDailySpend * 1.2) {
    speedMessage = `지금 속도로 쓰면 계획에 맞게 사용할 수 있습니다.`
  } else {
    speedMessage = `이번 달 남은 날짜를 생각하면 조금 천천히 쓰는 것이 좋습니다.`
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">아름드리꿈터</h1>
        <div className="text-xs font-bold px-3 py-1 bg-zinc-100 rounded-full text-zinc-500">
          {userName} 님
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 보기 모드 전환 */}
        {fundingSources.length > 1 && (
          <div className="flex bg-zinc-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('total')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'total'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              통합 보기
            </button>
            <button
              onClick={() => setViewMode('source')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'source'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              재원별 보기
            </button>
          </div>
        )}

        {viewMode === 'total' ? (
          <>
            {/* 통합 잔액 카드 - 시각화 강화 */}
            <section className={`flex flex-col gap-4 rounded-[3rem] p-10 shadow-xl ring-1 relative overflow-hidden transition-all duration-500
              ${visual.bgClass} ${visual.status === 'luxury' ? 'ring-green-200' : 
                visual.status === 'stable' ? 'ring-blue-200' : 
                visual.status === 'warning' ? 'ring-orange-200' : 
                visual.status === 'critical' || visual.status === 'empty' ? 'ring-red-200' : 
                'ring-zinc-200'}
            `}>
              <div className="flex justify-between items-start z-10 relative">
                <h2 className={`text-sm font-black uppercase tracking-[0.2em] ${
                  visual.themeColor === 'green' ? 'text-green-600' :
                  visual.themeColor === 'blue' ? 'text-blue-600' :
                  visual.themeColor === 'orange' ? 'text-orange-600' :
                  visual.themeColor === 'red' ? 'text-red-600' :
                  'text-zinc-400'
                }`}>이번 달 남은 돈</h2>
                <span className="px-2 py-1 rounded-lg bg-black/5 text-[9px] font-black text-zinc-500 tracking-wider">통합 예산</span>
              </div>
              
              <div className="flex items-end gap-2 z-10 relative my-2">
                <span className={`text-6xl sm:text-7xl font-black tracking-tighter transition-colors duration-500 ${
                  visual.themeColor === 'green' ? 'text-green-700' :
                  visual.themeColor === 'blue' ? 'text-blue-700' :
                  visual.themeColor === 'orange' ? 'text-orange-700' :
                  visual.themeColor === 'red' ? 'text-red-700' :
                  'text-zinc-900'
                }`}>
                  {formatCurrency(totalMonthBalance)}
                </span>
                <span className="text-2xl text-zinc-400 font-black mb-2">원</span>
              </div>
              
              {/* 상태 메시지 및 돈주머니 이미지 대용 아이콘 */}
              <div className={`mt-2 px-6 py-5 rounded-[2rem] z-10 relative border-2 shadow-inner transition-all duration-500 ${
                visual.themeColor === 'green' ? 'bg-white/80 border-green-100 text-green-800' : 
                visual.themeColor === 'blue' ? 'bg-white/80 border-blue-100 text-blue-800' : 
                visual.themeColor === 'orange' ? 'bg-white/80 border-orange-100 text-orange-800' : 
                visual.themeColor === 'red' ? 'bg-white/80 border-red-100 text-red-800' : 
                'bg-zinc-50 border-zinc-200 text-zinc-600'
              }`}>
                <div className="flex items-center gap-4">
                  <span className="text-4xl animate-bounce-slow">{visual.icon}</span>
                  <p className="text-lg font-black leading-tight break-keep">{visual.message}</p>
                </div>
              </div>

              {/* 속도 안내 - 디자인 슬림화 */}
              <div className="px-4 py-1 z-10 relative text-xs font-bold text-zinc-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse"></span>
                {speedMessage}
              </div>
              
              {/* 게이지 - 디자인 강화 */}
              <div className="flex flex-col gap-3 z-10 relative mt-4">
                <div className="flex justify-between text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">
                  <span>{remainingDays}일 남음</span>
                  <span className={
                    visual.themeColor === 'green' ? 'text-green-600' :
                    visual.themeColor === 'red' ? 'text-red-600' :
                    'text-zinc-500'
                  }>{visual.percentage}%</span>
                </div>
                <div className="h-6 w-full bg-black/5 rounded-full overflow-hidden p-1.5 shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 shadow-sm ${
                      visual.themeColor === 'green' ? 'bg-green-500' : 
                      visual.themeColor === 'blue' ? 'bg-blue-500' : 
                      visual.themeColor === 'orange' ? 'bg-orange-500' : 
                      visual.themeColor === 'red' ? 'bg-red-500' : 
                      'bg-zinc-900'
                    }`}
                    style={{ width: `${visual.percentage}%` }}
                  />
                </div>
              </div>
              
              {/* 배경 장식 큰 아이콘 */}
              <div className="absolute -right-10 -bottom-10 text-[12rem] opacity-[0.03] rotate-12 pointer-events-none select-none">
                {visual.icon}
              </div>
            </section>

            {/* 올해 예산 - 카드 스타일 조화 */}
            <section className="p-6 rounded-[2rem] bg-white ring-1 ring-zinc-100 flex justify-between items-center shadow-sm">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.2em]">올해 전체 잔액</span>
                <span className="text-2xl font-black text-zinc-800">{formatCurrency(totalYearBalance)}원</span>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">YEARLY TOTAL</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${totalYearlyBudget > 0 ? (totalYearBalance / totalYearlyBudget) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-black text-zinc-500">
                    {totalYearlyBudget > 0 ? Math.round((totalYearBalance / totalYearlyBudget) * 100) : 0}%
                  </span>
                </div>
              </div>
            </section>
          </>
        ) : (
          /* 재원별 보기 */
          <section className="flex flex-col gap-4">
            {fundingSources.map((fs) => {
              const fsPercentage = Number(fs.monthly_budget) > 0 
                ? Math.round((Number(fs.current_month_balance) / Number(fs.monthly_budget)) * 100) 
                : 0
              const fsVisual = getBudgetVisualInfo(
                Number(fs.current_month_balance), Number(fs.monthly_budget), remainingDays, totalDaysInMonth
              )
              
              return (
                <div key={fs.id} className={`p-6 rounded-3xl ring-1 shadow-sm transition-all ${
                  fsVisual.status === 'critical' ? 'bg-red-50 ring-red-200' :
                  fsVisual.status === 'warning' ? 'bg-orange-50 ring-orange-200' :
                  'bg-white ring-zinc-200'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{fs.name}</p>
                      <p className={`text-3xl font-black mt-1 ${
                        fsVisual.status === 'critical' ? 'text-red-600' :
                        fsVisual.status === 'warning' ? 'text-orange-600' :
                        'text-zinc-900'
                      }`}>{formatCurrency(Number(fs.current_month_balance))}원</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400 font-medium">월 {formatCurrency(Number(fs.monthly_budget))}원</p>
                      <p className={`text-lg font-black ${
                        fsPercentage <= 20 ? 'text-red-600' :
                        fsPercentage <= 40 ? 'text-orange-600' :
                        'text-zinc-900'
                      }`}>{fsPercentage}%</p>
                    </div>
                  </div>
                  
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        fsVisual.status === 'critical' ? 'bg-red-500' :
                        fsVisual.status === 'warning' ? 'bg-orange-500' :
                        'bg-zinc-900'
                      }`}
                      style={{ width: `${fsPercentage}%` }}
                    />
                  </div>

                  <p className={`mt-3 text-sm font-medium ${
                    fsVisual.status === 'critical' ? 'text-red-500' :
                    fsVisual.status === 'warning' ? 'text-orange-500' :
                    'text-zinc-500'
                  }`}>{fsVisual.message}</p>

                  <div className="mt-3 pt-3 border-t border-zinc-200 flex justify-between text-xs text-zinc-400">
                    <span>연 잔액: {formatCurrency(Number(fs.current_year_balance))}원</span>
                    <span>연 예산: {formatCurrency(Number(fs.yearly_budget))}원</span>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* 빠른 실행 버튼 */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">오늘의 선택</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/receipt" className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-95">
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">📸</span>
              <span className="text-base font-black text-zinc-800">영수증</span>
              <span className="text-[10px] text-zinc-400 mt-0.5 font-bold">사진 찍기</span>
            </Link>
            <Link href="/plan" className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-95">
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">🤔</span>
              <span className="text-base font-black text-zinc-800">계획</span>
              <span className="text-[10px] text-zinc-400 mt-0.5 font-bold">미리보기</span>
            </Link>
          </div>
        </section>

        {/* 최근 사용 내역 */}
        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">최근 사용</h3>
            <Link href="/calendar" className="text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors">
              전체 보기 →
            </Link>
          </div>
          
          {recentTransactions.length === 0 ? (
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-center text-zinc-400 text-sm font-medium">
              아직 사용 내역이 없습니다.
            </div>
          ) : (
            recentTransactions.map((tx: any) => (
              <div key={tx.id} className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${tx.status === 'confirmed' ? 'bg-green-500' : 'bg-orange-400'}`} />
                  <div>
                    <p className="font-bold text-zinc-800 text-sm">{tx.activity_name}</p>
                    <p className="text-[11px] text-zinc-400">{tx.date} · {tx.category || '미분류'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-zinc-900 text-sm">-{formatCurrency(tx.amount)}원</p>
                  <span className={`text-[10px] font-bold ${
                    tx.status === 'confirmed' ? 'text-green-600' : 'text-orange-500'
                  }`}>
                    {tx.status === 'confirmed' ? '확정' : '임시'}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  )
}
