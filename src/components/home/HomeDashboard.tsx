'use client'

import { useState, useRef } from 'react'
import { formatCurrency, getBudgetVisualInfo } from '@/utils/budget-visuals'
import Link from 'next/link'
import BalanceVisualWidget from './BalanceVisualWidget'
import BudgetTrendChart from './BudgetTrendChart'
import BlockCustomizeSheet from './BlockCustomizeSheet'
import { UIPreferences, DEFAULT_PREFERENCES } from '@/types/ui-preferences'
import { saveUIPreferences } from '@/app/actions/preferences'

interface FundingSource {
  id: string
  name: string
  monthly_budget: number
  yearly_budget: number
  current_month_balance: number
  current_year_balance: number
}

interface DailyTransaction {
  date: string
  amount: number
  activity_name: string
  status: 'pending' | 'confirmed'
  receipt_image_url?: string | null
}

interface MonthlyData {
  month: string
  totalSpent: number
  budget: number
}

interface HomeDashboardProps {
  profile: any
  participant: any
  participantId: string
  fundingSources: FundingSource[]
  recentTransactions: any[]
  remainingDays: number
  totalDaysInMonth: number
  elapsedDays: number
  userName: string
  dailyTransactions?: DailyTransaction[]
  monthlyTrend?: MonthlyData[]
  uiPreferences?: UIPreferences | null
  latestEvaluation?: { month: string; tried: string | null; learned: string | null } | null
}

type ViewMode = 'total' | 'source'

export default function HomeDashboard({
  profile, participant, participantId, fundingSources, recentTransactions,
  remainingDays, totalDaysInMonth, elapsedDays, userName,
  dailyTransactions = [], monthlyTrend = [],
  uiPreferences, latestEvaluation,
}: HomeDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('total')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [localPreferences, setLocalPreferences] = useState<UIPreferences>(
    uiPreferences ?? DEFAULT_PREFERENCES
  )

  const enabled = new Set(localPreferences.enabled_blocks)

  async function handleSavePreferences(newPrefs: UIPreferences) {
    setLocalPreferences(newPrefs)
    setIsSheetOpen(false)
    await saveUIPreferences(participantId, newPrefs)
  }

  // 통합 계산
  const totalMonthlyBudget = fundingSources.reduce((acc, fs) => acc + Number(fs.monthly_budget), 0) || participant.monthly_budget_default
  const totalMonthBalance = fundingSources.reduce((acc, fs) => acc + Number(fs.current_month_balance), 0)
  const totalYearBalance = fundingSources.reduce((acc, fs) => acc + Number(fs.current_year_balance), 0)
  const totalYearlyBudget = fundingSources.reduce((acc, fs) => acc + Number(fs.yearly_budget), 0) || participant.yearly_budget_default

  const visual = getBudgetVisualInfo(totalMonthBalance, totalMonthlyBudget, remainingDays, totalDaysInMonth)

  // 순차 등장 블록 인덱스 (각 블록마다 0.08s 간격)
  let staggerIdx = 0
  const stagger = () => ({ animationDelay: `${(staggerIdx++) * 0.08}s` })

  return (
    <div className="flex flex-col min-h-screen easy-read-bg text-foreground pb-20 participant-view">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-bold tracking-tight text-foreground">아름드리꿈터</h1>
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold px-3 py-1.5 bg-primary/10 rounded-full text-primary">
            {userName} 님
          </div>
          <Link
            href="/more"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-all active:scale-95"
            aria-label="설정"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 보기 모드 전환 */}
        {fundingSources.length > 1 && (
          <div className="flex bg-zinc-100 rounded-xl p-1 gap-1 stagger-item" style={stagger()}>
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
            {/* [필수] 잔액 시각화 위젯 */}
            <div className="stagger-item" style={stagger()}>
              <BalanceVisualWidget
                currentBalance={totalMonthBalance}
                totalBudget={totalMonthlyBudget}
                percentage={visual.percentage}
                themeColor={visual.themeColor}
                icon={visual.icon}
                statusMessage={visual.message}
                remainingDays={remainingDays}
                dailyTransactions={dailyTransactions}
                participantId={participantId}
                fundingSources={fundingSources}
              />
            </div>

            {/* [선택] 올해 잔액 카드 */}
            {enabled.has('yearly_balance') && (
              <section className="p-6 rounded-[2rem] bg-white ring-1 ring-zinc-100 flex justify-between items-center shadow-sm stagger-item" style={stagger()}>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">올해 전체 잔액</span>
                  <span className="text-2xl font-black text-zinc-800">{formatCurrency(totalYearBalance)}원</span>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-xs text-zinc-400 font-bold uppercase">연간 예산</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={totalYearlyBudget > 0 ? Math.round((totalYearBalance / totalYearlyBudget) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label={`연간 예산 잔액 ${totalYearlyBudget > 0 ? Math.round((totalYearBalance / totalYearlyBudget) * 100) : 0}%`}>
                      <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${totalYearlyBudget > 0 ? (totalYearBalance / totalYearlyBudget) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-black text-zinc-500">
                      {totalYearlyBudget > 0 ? Math.round((totalYearBalance / totalYearlyBudget) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* [선택] 월별 예산 추이 차트 */}
            {enabled.has('monthly_trend') && monthlyTrend.length > 0 && (
              <div className="stagger-item" style={stagger()}>
                <BudgetTrendChart monthlyData={monthlyTrend} />
              </div>
            )}
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
                      <p className="text-xs text-zinc-400 font-medium">월 {formatCurrency(Number(fs.monthly_budget))}원</p>
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

        {/* [선택] 계획 AI 바로가기 */}
        {enabled.has('plan_shortcut') && (
          <Link
            href="/plan"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-[0.98] stagger-item"
            style={stagger()}
          >
            <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-3xl">🤔</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-800 text-base">오늘 계획 AI</p>
              <p className="text-xs text-zinc-400 font-bold mt-0.5">오늘 활동을 미리 계획해요</p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors text-lg">→</span>
          </Link>
        )}

        {/* [선택] 최근 사용 내역 */}
        {enabled.has('recent_transactions') && (
          <section className="flex flex-col gap-3 stagger-item" style={stagger()}>
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
                    {tx.receipt_image_url ? (
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-zinc-200">
                        <img src={tx.receipt_image_url} alt="영수증" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${tx.status === 'confirmed' ? 'bg-green-500' : 'bg-orange-400'}`} />
                        <span className="text-xs font-bold text-zinc-500">{tx.status === 'confirmed' ? '✓' : '⏳'}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-zinc-800 text-sm">{tx.activity_name}</p>
                      <p className="text-xs text-zinc-400">{tx.date} · {tx.category || '미분류'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-900 text-sm">-{formatCurrency(tx.amount)}원</p>
                    <span className={`text-xs font-bold ${
                      tx.status === 'confirmed' ? 'text-green-600' : 'text-orange-500'
                    }`}>
                      {tx.status === 'confirmed' ? '확정' : '임시'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* [선택] 지원자 편지 */}
        {enabled.has('evaluation_letter') && latestEvaluation && (
          <section className="p-6 rounded-[2rem] bg-white ring-1 ring-zinc-100 shadow-sm flex flex-col gap-3 stagger-item" style={stagger()}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">💌</span>
              <div>
                <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">지원자 편지</p>
                <p className="text-sm font-bold text-zinc-600">{latestEvaluation.month} 평가</p>
              </div>
            </div>
            {latestEvaluation.tried && (
              <p className="text-sm text-zinc-600 leading-relaxed line-clamp-3">{latestEvaluation.tried}</p>
            )}
          </section>
        )}
      </main>

      {/* FAB + 버튼: 블록 커스터마이징 */}
      <button
        onClick={() => setIsSheetOpen(true)}
        className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-zinc-900 text-white shadow-xl text-2xl flex items-center justify-center active:scale-95 transition-transform"
        aria-label="화면 구성 편집"
      >
        +
      </button>

      {/* 블록 커스터마이징 바텀시트 */}
      <BlockCustomizeSheet
        isOpen={isSheetOpen}
        currentPreferences={localPreferences}
        onSave={handleSavePreferences}
        onClose={() => setIsSheetOpen(false)}
      />
    </div>
  )
}
