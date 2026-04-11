"use client"

import { useState } from 'react'
import PlanComparison from './PlanComparison'
interface PlanOption {
  name: string
  cost: number
  time: string
  icon: string
  description?: string
}

export default function PlanComparisonContainer({ totalBalance }: { totalBalance: number }) {
  const [loading, setLoading] = useState(false)
  const [planData, setPlanData] = useState<{ activityName: string, options: PlanOption[] } | null>(null)

  const handleGetRecommendation = async () => {
    setLoading(true)
    // 이 컴포넌트는 더 이상 사용하지 않습니다.
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-8">
      {!planData ? (
        <div className="flex flex-col items-center gap-6 py-12 bg-white rounded-[3rem] ring-1 ring-zinc-100 shadow-sm">
          <span className="text-7xl animate-bounce-slow">🤔</span>
          <div className="text-center">
            <h3 className="text-xl font-black text-zinc-900 mb-2">오늘은 무엇을 할까요?</h3>
            <p className="text-zinc-500 font-medium px-8">AI가 현재 남은 돈으로<br/>할 수 있는 즐거운 활동을 추천해드려요.</p>
          </div>
          <button
            onClick={handleGetRecommendation}
            disabled={loading}
            className="mt-4 px-8 py-4 rounded-2xl bg-zinc-900 text-white font-black shadow-lg hover:bg-zinc-800 active:scale-95 disabled:bg-zinc-200 transition-all"
          >
            {loading ? '생각 중...' : '✨ AI 추천 받기'}
          </button>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PlanComparison 
            activityName={planData.activityName}
            initialOptions={planData.options}
            currentBalance={totalBalance}
          />
          <button 
            onClick={() => setPlanData(null)}
            className="w-full mt-6 py-4 rounded-2xl bg-zinc-100 text-zinc-500 font-bold text-sm hover:bg-zinc-200 transition-colors"
          >
            다른 활동 추천받기
          </button>
        </div>
      )}
    </div>
  )
}
