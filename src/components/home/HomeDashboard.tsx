'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { formatCurrency, getBudgetVisualInfo } from '@/utils/budget-visuals'
import { speak } from '@/utils/tts'
import Link from 'next/link'
import { EasyTerm } from '@/components/ui/EasyTerm'
import BalanceVisualWidget from './BalanceVisualWidget'
import BudgetTrendChart from './BudgetTrendChart'
import BlockCustomizeSheet from './BlockCustomizeSheet'
import WeeklyChartBlock from './WeeklyChartBlock'
import { UIPreferences, DEFAULT_PREFERENCES, BlockId } from '@/types/ui-preferences'
import { saveUIPreferences } from '@/app/actions/preferences'
import NavDropdown from '@/components/layout/NavDropdown'
import HelpButton from '@/components/help/HelpButton'
import FaqButton from '@/components/ui/FaqButton'

import EasyModeOnboarding from './EasyModeOnboarding'
import HelpAutoTrigger from '@/components/help/HelpAutoTrigger'
import ImageLightbox from '@/components/ui/ImageLightbox'

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
  activity_image_url?: string | null
}

interface MonthlyTx {
  id: string
  activity_name: string
  amount: number
  date: string
  category?: string | null
}

interface MonthlyData {
  month: string
  totalSpent: number
  budget: number
  transactions?: MonthlyTx[]
}

interface HomeDashboardProps {
  participant: any
  participantId: string
  fundingSources: FundingSource[]
  recentTransactions: any[]
  remainingDays: number
  totalDaysInMonth: number
  userName: string
  dailyTransactions?: DailyTransaction[]
  monthlyTrend?: MonthlyData[]
  uiPreferences?: UIPreferences | null
  latestEvaluation?: { month: string; easy_summary: string | null; next_step: string | null } | null
  monthlyPlanProgress?: import('@/app/actions/monthlyPlan').MonthlyPlanProgress[]
  currentMonth?: string
}

export default function HomeDashboard({
  participant, participantId, fundingSources, recentTransactions,
  remainingDays, totalDaysInMonth, userName,
  dailyTransactions = [], monthlyTrend = [],
  uiPreferences, latestEvaluation,
  monthlyPlanProgress = [], currentMonth,
}: HomeDashboardProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [localPreferences, setLocalPreferences] = useState<UIPreferences>(
    uiPreferences ?? DEFAULT_PREFERENCES
  )

  // 미리보기 등 외부에서 uiPreferences prop이 바뀌면 즉시 동기화
  useEffect(() => {
    setLocalPreferences(uiPreferences ?? DEFAULT_PREFERENCES)
  }, [uiPreferences])

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

  // ── 블록별 렌더 함수 (enabled_blocks 배열 순서에 따라 호출) ──────
  function renderBlock(blockId: BlockId) {
    switch (blockId) {

      case 'source_view':
        if (fundingSources.length === 0) return null
        return (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">
              <EasyTerm formal="재원별 잔액" easy="돈 종류별 남은 돈" />
            </h3>
            {fundingSources.map((fs) => {
              const fsPercentage = Number(fs.monthly_budget) > 0
                ? Math.round((Number(fs.current_month_balance) / Number(fs.monthly_budget)) * 100)
                : 0
              const fsVisual = getBudgetVisualInfo(
                Number(fs.current_month_balance), Number(fs.monthly_budget), remainingDays, totalDaysInMonth
              )
              return (
                <div key={fs.id} className={`p-5 rounded-3xl ring-1 shadow-sm transition-all ${
                  fsVisual.status === 'critical' ? 'bg-red-50 ring-red-200' :
                  fsVisual.status === 'warning'  ? 'bg-orange-50 ring-orange-200' :
                  'bg-white ring-zinc-100'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{fs.name}</p>
                      <p className={`text-2xl font-black mt-1 hc-amount ${
                        fsVisual.status === 'critical' ? 'text-red-600' :
                        fsVisual.status === 'warning'  ? 'text-orange-600' : 'text-zinc-900'
                      }`}>{formatCurrency(Number(fs.current_month_balance))}원</p>
                    </div>
                    <p className={`text-lg font-black hc-amount ${
                      fsPercentage <= 20 ? 'text-red-600' :
                      fsPercentage <= 40 ? 'text-orange-600' : 'text-zinc-900'
                    }`}>{fsPercentage}<EasyTerm formal="%" easy="퍼센트" /></p>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden hc-gauge">
                    <div
                      className={`h-full rounded-full transition-all hc-gauge-fill ${
                        fsVisual.status === 'critical' ? 'bg-red-500' :
                        fsVisual.status === 'warning'  ? 'bg-orange-500' : 'bg-zinc-900'
                      }`}
                      style={{ width: `${fsPercentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </section>
        )

      case 'yearly_balance':
        return (
          <section className="p-6 rounded-[2rem] bg-white ring-1 ring-zinc-100 flex justify-between items-center shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">
                <EasyTerm formal="올해 전체 잔액" easy="올해 남은 돈" />
              </span>
              <span className="text-2xl font-black text-zinc-800 hc-amount">{formatCurrency(totalYearBalance)}원</span>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="text-xs text-zinc-400 font-bold">
                <EasyTerm formal="연간 예산" easy="1년 쓸 수 있는 돈" />
              </span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden hc-gauge">
                  <div className="h-full bg-zinc-400 rounded-full hc-gauge-fill" style={{ width: `${totalYearlyBudget > 0 ? (totalYearBalance / totalYearlyBudget) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-black text-zinc-500 hc-amount">
                  {totalYearlyBudget > 0 ? Math.round((totalYearBalance / totalYearlyBudget) * 100) : 0}<EasyTerm formal="%" easy="퍼센트" />
                </span>
              </div>
            </div>
          </section>
        )

      case 'monthly_trend':
        if (monthlyTrend.length === 0) return null
        return <BudgetTrendChart monthlyData={monthlyTrend} />

      case 'weekly_chart':
        if (dailyTransactions.length === 0) return null
        return <WeeklyChartBlock dailyTransactions={dailyTransactions} themeColor={visual.themeColor} />

      case 'plan_shortcut':
        return (
          <Link
            href="/plan"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-3xl">🤔</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-800 text-base">오늘 계획 AI</p>
              <p className="text-xs text-zinc-400 font-bold mt-0.5">오늘 활동을 미리 계획해요</p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors text-lg">▸</span>
          </Link>
        )

      case 'calendar_shortcut':
        return (
          <Link
            href="/calendar"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-3xl">📅</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-800 text-base">달력 보기</p>
              <p className="text-xs text-zinc-400 font-bold mt-0.5">이번 달 활동을 달력에서 확인하세요</p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors text-lg">▸</span>
          </Link>
        )

      case 'recent_transactions':
        return (
          <section className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">
                  <EasyTerm formal="최근 사용 내역" easy="최근에 쓴 돈" />
                </h3>
                {recentTransactions.length > 0 && (
                  <button
                    onClick={() => {
                      const txText = recentTransactions.slice(0, 3)
                        .map((tx: any) => `${tx.activity_name} ${formatCurrency(tx.amount)}원`)
                        .join(', ')
                      speak(`최근 사용 내역입니다. ${txText}`)
                    }}
                    className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs active:scale-95"
                    aria-label="최근 내역 음성으로 듣기"
                  >🔊</button>
                )}
              </div>
              <Link href="/calendar" className="text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors">
                전체 보기
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-center text-zinc-400 text-sm font-medium">
                아직 쓴 적이 없어요.
              </div>
            ) : (
              recentTransactions.map((tx: any) => (
                <div key={tx.id} className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {tx.receipt_image_url ? (
                      <button
                        className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-zinc-200 cursor-zoom-in"
                        onClick={() => setLightboxSrc(tx.receipt_image_url)}
                      >
                        <Image src={tx.receipt_image_url} alt="영수증" fill sizes="40px" className="object-cover" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${tx.status === 'confirmed' ? 'bg-green-500' : 'bg-orange-400'}`} />
                        <span className="text-xs font-bold text-zinc-500">{tx.status === 'confirmed' ? '✓' : '⏳'}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-zinc-800 text-sm">{tx.activity_name}</p>
                      <p className="text-xs text-zinc-400">{tx.date} · {tx.category || '종류 없음'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-900 text-sm hc-amount">-{formatCurrency(tx.amount)}원</p>
                    <span className={`text-xs font-bold ${tx.status === 'confirmed' ? 'text-green-600' : 'text-orange-500'}`}>
                      {tx.status === 'confirmed'
                        ? <EasyTerm formal="확정" easy="확인됨" />
                        : <EasyTerm formal="임시" easy="확인 중" />
                      }
                    </span>
                  </div>
                </div>
              ))
            )}
          </section>
        )

      case 'map_widget':
        return (
          <Link
            href="/map"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-3xl">🗺️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-800 text-base">활동 지도</p>
              <p className="text-xs text-zinc-400 font-bold mt-0.5">돈을 쓴 곳을 지도에서 봐요</p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors text-lg">▸</span>
          </Link>
        )

      case 'activity_gallery':
        return (
          <Link
            href="/gallery"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-3xl">🖼️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-zinc-800 text-base">활동 사진</p>
              <p className="text-xs text-zinc-400 font-bold mt-0.5">활동 사진을 모아볼 수 있어요</p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors text-lg">▸</span>
          </Link>
        )

      case 'evaluation_letter':
        if (!latestEvaluation || !latestEvaluation.easy_summary) return null
        return (
          <Link href="/evaluations">
            <section className="p-6 rounded-[2rem] bg-white ring-1 ring-zinc-100 shadow-sm flex flex-col gap-3 hover:ring-zinc-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">💌</span>
                  <div>
                    <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">
                      <EasyTerm formal="지원자 편지" easy="선생님 편지" />
                    </p>
                    <p className="text-sm font-bold text-zinc-600">
                      {new Date(latestEvaluation.month).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 편지
                    </p>
                  </div>
                </div>
                <span className="text-xs text-zinc-400">읽기 →</span>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed line-clamp-3 bg-zinc-50 rounded-2xl p-4">
                {latestEvaluation.easy_summary}
              </p>
              {latestEvaluation.next_step && (
                <p className="text-xs text-blue-600 font-bold px-1">
                  ✨ 다음 달 약속: {latestEvaluation.next_step}
                </p>
              )}
            </section>
          </Link>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex flex-col min-h-dvh easy-read-bg text-foreground participant-view pb-10">
      <HelpAutoTrigger sectionKey="home" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-background/90 backdrop-blur-md border-b border-border">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground hover:opacity-70 transition-opacity">아름드리꿈터</Link>
        <div className="flex items-center gap-1.5">
          {/* 도움말, 궁금한 점, 꾸미기 묶음 */}
          <div className="flex items-center gap-1 bg-zinc-100 rounded-full p-1">
            <HelpButton
              sectionKey="home"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-zinc-600 hover:bg-white hover:shadow-sm transition-all active:scale-95"
              text={<span className="text-xs font-black">? 도움말</span>}
            />
            <FaqButton
              variant="inline"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-zinc-600 hover:bg-white hover:shadow-sm transition-all active:scale-95"
            />
            <button
              onClick={() => setIsSheetOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-zinc-600 hover:bg-white hover:shadow-sm transition-all active:scale-95"
              aria-label="화면 꾸미기"
              title="화면 구성 편집"
            >
              <span className="text-xs font-black">⚙️ 꾸미기</span>
            </button>
          </div>
          
          <div className="text-xs font-bold px-2.5 py-1.5 bg-primary/10 rounded-full text-primary whitespace-nowrap hidden sm:block ml-1">
            {userName} 님
          </div>
          <NavDropdown />
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 flex flex-col gap-4">
        {/* [필수] 잔액 시각화 위젯 */}
        <div className="stagger-item" style={{ animationDelay: '0s' }}>
          <BalanceVisualWidget
            currentBalance={totalMonthBalance}
            totalBudget={totalMonthlyBudget}
            percentage={visual.percentage}
            themeColor={visual.themeColor}
            icon={visual.icon}
            statusMessage={visual.message}
            remainingDays={remainingDays}
            participantId={participantId}
            fundingSources={fundingSources}
            monthlyPlanProgress={monthlyPlanProgress}
            currentMonth={currentMonth}
          />
        </div>

        {/* [선택] enabled_blocks 배열 순서대로 렌더링 */}
        {localPreferences.enabled_blocks.map((blockId, idx) => {
          const content = renderBlock(blockId)
          if (!content) return null
          return (
            <div key={blockId} className="stagger-item" style={{ animationDelay: `${(idx + 1) * 0.08}s` }}>
              {content}
            </div>
          )
        })}
      </main>



      {/* 블록 커스터마이징 바텀시트 */}
      <BlockCustomizeSheet
        isOpen={isSheetOpen}
        currentPreferences={localPreferences}
        onSave={handleSavePreferences}
        onClose={() => setIsSheetOpen(false)}
      />

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* 첫 사용 시 쉬운 말 모드 선택 온보딩 */}
      <EasyModeOnboarding />
    </div>
  )
}
