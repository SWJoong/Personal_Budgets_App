'use client'

import { formatCurrency, getBudgetVisualInfo } from '@/utils/budget-visuals'

interface FundingSource {
  id: string
  name: string
  monthly_budget: number
  yearly_budget: number
  current_month_balance: number
  current_year_balance: number
}

interface ParticipantPreviewCardProps {
  participant: {
    id: string
    name: string
    email: string
    monthly_budget_default: number
    yearly_budget_default: number
    funding_sources?: FundingSource[]
  }
  onClick?: () => void
}

export default function ParticipantPreviewCard({ participant, onClick }: ParticipantPreviewCardProps) {
  const fundingSources = participant.funding_sources || []

  // 통합 계산
  const totalMonthlyBudget = fundingSources.reduce((acc, fs) => acc + Number(fs.monthly_budget), 0) || participant.monthly_budget_default || 0
  const totalMonthBalance = fundingSources.reduce((acc, fs) => acc + Number(fs.current_month_balance), 0)

  // 날짜 계산
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
  const remainingDays = totalDaysInMonth - now.getDate() + 1

  const visual = getBudgetVisualInfo(totalMonthBalance, totalMonthlyBudget, remainingDays, totalDaysInMonth)

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl ring-2 shadow-md transition-all cursor-pointer hover:scale-[1.02] hover:shadow-lg ${
        visual.status === 'luxury' ? 'bg-green-50 ring-green-200 hover:ring-green-300' :
        visual.status === 'stable' ? 'bg-blue-50 ring-blue-200 hover:ring-blue-300' :
        visual.status === 'warning' ? 'bg-orange-50 ring-orange-200 hover:ring-orange-300' :
        visual.status === 'critical' || visual.status === 'empty' ? 'bg-red-50 ring-red-200 hover:ring-red-300' :
        'bg-white ring-zinc-200 hover:ring-zinc-300'
      }`}
    >
      {/* 참가자 이름 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm ${
            visual.themeColor === 'green' ? 'bg-green-500' :
            visual.themeColor === 'blue' ? 'bg-blue-500' :
            visual.themeColor === 'orange' ? 'bg-orange-500' :
            visual.themeColor === 'red' ? 'bg-red-500' :
            'bg-zinc-400'
          }`}>
            {participant.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-black text-zinc-900 text-base">{participant.name}</h3>
            <p className="text-xs text-zinc-400 font-medium">{participant.email}</p>
          </div>
        </div>
        <span className="text-3xl">{visual.icon}</span>
      </div>

      {/* 예산 정보 */}
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">이번 달 잔액</span>
            <p className={`text-2xl font-black ${
              visual.themeColor === 'green' ? 'text-green-600' :
              visual.themeColor === 'blue' ? 'text-blue-600' :
              visual.themeColor === 'orange' ? 'text-orange-600' :
              visual.themeColor === 'red' ? 'text-red-600' :
              'text-zinc-900'
            }`}>
              {formatCurrency(totalMonthBalance)}원
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400 font-medium">예산</span>
            <p className="text-sm font-bold text-zinc-600">{formatCurrency(totalMonthlyBudget)}원</p>
          </div>
        </div>

        {/* 게이지 바 */}
        <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              visual.themeColor === 'green' ? 'bg-green-500' :
              visual.themeColor === 'blue' ? 'bg-blue-500' :
              visual.themeColor === 'orange' ? 'bg-orange-500' :
              visual.themeColor === 'red' ? 'bg-red-500' :
              'bg-zinc-400'
            }`}
            style={{ width: `${visual.percentage}%` }}
          />
        </div>

        <div className="flex justify-between mt-1.5 text-xs font-bold">
          <span className="text-zinc-500">{remainingDays}일 남음</span>
          <span className={
            visual.themeColor === 'green' ? 'text-green-600' :
            visual.themeColor === 'blue' ? 'text-blue-600' :
            visual.themeColor === 'orange' ? 'text-orange-600' :
            visual.themeColor === 'red' ? 'text-red-600' :
            'text-zinc-500'
          }>{visual.percentage}%</span>
        </div>
      </div>

      {/* 상태 메시지 */}
      <div className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
        visual.themeColor === 'green' ? 'bg-white/60 text-green-700' :
        visual.themeColor === 'blue' ? 'bg-white/60 text-blue-700' :
        visual.themeColor === 'orange' ? 'bg-white/60 text-orange-700' :
        visual.themeColor === 'red' ? 'bg-white/60 text-red-700' :
        'bg-white/60 text-zinc-600'
      }`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        {visual.message}
      </div>

      {/* 재원 정보 */}
      {fundingSources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/50 flex flex-wrap gap-1.5">
          {fundingSources.slice(0, 2).map((fs) => (
            <span key={fs.id} className="text-xs font-bold text-zinc-500 bg-white/40 px-2 py-1 rounded-lg">
              {fs.name}
            </span>
          ))}
          {fundingSources.length > 2 && (
            <span className="text-xs font-bold text-zinc-400 bg-white/40 px-2 py-1 rounded-lg">
              +{fundingSources.length - 2}개
            </span>
          )}
        </div>
      )}
    </div>
  )
}
