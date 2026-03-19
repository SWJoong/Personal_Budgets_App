'use client'

import { useState } from 'react'
import { formatCurrency, getBudgetVisualInfo } from '@/utils/budget-visuals'
import Link from 'next/link'

// === 우태욱 님 개별지원계획서 기반 샘플 데이터 ===
const sampleActivities = [
  { id: '1', name: '볼링장 가기', icon: '🎳' },
  { id: '2', name: '댄스 학원 가기', icon: '🕺' },
  { id: '3', name: '단골 카페 가기', icon: '☕' }
]

const optionSimulations: Record<string, any> = {
  '볼링장 가기': [
    {
      id: 'opt1',
      title: '택시 타고 가기',
      cost: 12000,
      timeText: '15분',
      desc: '택시를 타면 빠르고 편하지만, 예산이 많이 줄어들어요.',
      tags: ['비용 높음', '빠름']
    },
    {
      id: 'opt2',
      title: '버스 타고 가기',
      cost: 1400,
      timeText: '45분',
      desc: '버스를 타면 조금 피곤하지만, 돈을 아끼고 정류장까지 걸으며 체중 조절에 도움을 줄 수 있어요!',
      tags: ['비용 낮음', '운동(건강)']
    }
  ],
  '댄스 학원 가기': [
    {
      id: 'opt3',
      title: '혼자 버스 타고 가기',
      cost: 1400,
      timeText: '30분',
      desc: '혼자 대중교통을 이용하며 자립심을 기를 수 있어요.',
      tags: ['비용 낮음', '자립 연습']
    },
    {
      id: 'opt4',
      title: '택시 타고 가기',
      cost: 9500,
      timeText: '10분',
      desc: '빠르게 학원에 갈 수 있지만 다른 간식을 사 먹을 돈이 부족해질 수 있어요.',
      tags: ['비용 높음', '빠름']
    }
  ],
  '단골 카페 가기': [
    {
      id: 'opt5',
      title: '따뜻한 아메리카노 마시기',
      cost: 4500,
      timeText: '1시간',
      desc: '당분을 줄여 체중 조절 목표를 지킬 수 있는 좋은 선택이에요!',
      tags: ['비용 보통', '건강']
    },
    {
      id: 'opt6',
      title: '케이크와 달콤한 음료 먹기',
      cost: 12000,
      timeText: '1시간',
      desc: '맛있지만 돈을 많이 쓰고 체중 조절 목표 달성이 어려워질 수 있어요.',
      tags: ['비용 높음', '주의']
    }
  ]
}

export default function PlanSimulationPage() {
  const [selectedActivity, setSelectedActivity] = useState('')
  const [selectedOption, setSelectedOption] = useState<any>(null)

  // 가상의 한 달 예산 (MVP 시뮬레이션용 데이터)
  const currentMonthBalance = 500000
  const monthlyBudget = 600000
  const remainingDays = 15
  const totalDays = 30

  // 시뮬레이션 결과 계산
  const simulatedBalance = selectedOption ? currentMonthBalance - selectedOption.cost : currentMonthBalance
  const visualBefore = getBudgetVisualInfo(currentMonthBalance, monthlyBudget, remainingDays, totalDays)
  const visualAfter = getBudgetVisualInfo(simulatedBalance, monthlyBudget, remainingDays, totalDays)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/" className="text-zinc-600 font-bold hover:text-zinc-900 transition-colors mr-3">
          ← 홈으로
        </Link>
        <h1 className="text-xl font-bold tracking-tight">오늘 계획 (시뮬레이션)</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-8">
        {/* 1. 활동 선택 영역 */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">어떤 활동을 할까요?</h2>
            <p className="text-sm font-medium text-zinc-500 break-keep">
              하고 싶은 활동을 고르면, 쓸 수 있는 방법들을 비교해 드려요.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 mt-2">
            {sampleActivities.map((act) => (
              <button
                key={act.id}
                onClick={() => {
                  setSelectedActivity(act.name)
                  setSelectedOption(null)
                }}
                className={`p-5 rounded-2xl flex items-center justify-between transition-all ring-1 active:scale-[0.98] ${
                  selectedActivity === act.name
                    ? 'bg-zinc-900 ring-zinc-900 text-white shadow-md'
                    : 'bg-white ring-zinc-200 text-zinc-700 hover:ring-zinc-400'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{act.icon}</span>
                  <span className="text-lg font-bold">{act.name}</span>
                </div>
                {selectedActivity === act.name && <span className="text-xl">✅</span>}
              </button>
            ))}
          </div>
        </section>

        {/* 2. 시뮬레이션 선택지 영역 */}
        {selectedActivity && optionSimulations[selectedActivity] && (
          <section className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest border-t border-zinc-200 pt-8">방법 비교하기</h3>
            <div className="flex flex-col gap-4">
              {optionSimulations[selectedActivity].map((opt: any) => {
                const isSelected = selectedOption?.id === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOption(opt)}
                    className={`flex flex-col gap-4 p-6 rounded-3xl transition-all ring-2 text-left active:scale-[0.98] relative overflow-hidden ${
                      isSelected
                        ? 'bg-blue-50 ring-blue-500 shadow-md'
                        : 'bg-white ring-zinc-100 hover:ring-zinc-300'
                    }`}
                  >
                    <div className="flex justify-between items-start w-full relative z-10">
                      <div>
                        <h4 className={`text-lg font-black ${isSelected ? 'text-blue-900' : 'text-zinc-800'}`}>
                          {opt.title}
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {opt.tags.map((tag: string) => (
                            <span key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                              tag.includes('비용 높음') || tag.includes('주의') ? 'bg-red-100 text-red-600' :
                              tag.includes('건강') || tag.includes('자립') || tag.includes('비용 낮음') ? 'bg-green-100 text-green-700' :
                              'bg-zinc-100 text-zinc-600'
                            }`}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end align-right">
                        <span className={`text-xl font-black ${isSelected ? 'text-blue-700' : 'text-zinc-900'}`}>
                          {formatCurrency(opt.cost)}원
                        </span>
                        <span className="text-xs font-bold text-zinc-400 mt-1">예상 {opt.timeText}</span>
                      </div>
                    </div>
                    
                    <p className={`text-sm font-medium leading-relaxed relative z-10 ${isSelected ? 'text-blue-800' : 'text-zinc-500'}`}>
                      {opt.desc}
                    </p>

                    {isSelected && (
                      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-blue-100/50 to-transparent pointer-events-none" />
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* 3. 미리보기 (선택 후) */}
        {selectedOption && (
          <section className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 border-t border-zinc-200 pt-8">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">미리보기 (시뮬레이션)</h3>
            
            <div className={`p-6 rounded-[2rem] flex flex-col gap-5 shadow-sm ring-1 transition-colors ${
              visualAfter.status === 'danger' ? 'bg-red-50 ring-red-200' :
              visualAfter.status === 'warning' ? 'bg-orange-50 ring-orange-200' :
              'bg-blue-50 ring-blue-200'
            }`}>
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-4xl ring-1 ring-black/5">
                  {visualAfter.icon}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-zinc-500">선택 후 남는 예산</span>
                  <div className="flex items-end gap-1">
                    <span className={`text-3xl font-black tracking-tighter ${
                      visualAfter.status === 'danger' ? 'text-red-600' :
                      visualAfter.status === 'warning' ? 'text-orange-600' :
                      'text-blue-700'
                    }`}>
                      {formatCurrency(simulatedBalance)}
                    </span>
                    <span className="text-lg font-black text-zinc-400 mb-0.5">원</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full opacity-80 py-2 border-y border-black/5">
                <div className="flex-1 text-center font-medium text-xs text-zinc-500">
                  원래 잔액<br/><b className="text-zinc-700 text-sm">{formatCurrency(currentMonthBalance)}원</b>
                </div>
                <div className="text-zinc-400 font-black">→</div>
                <div className="flex-1 text-center font-medium text-xs text-red-500">
                  차감<br/><b className="text-red-600 text-sm">-{formatCurrency(selectedOption.cost)}원</b>
                </div>
              </div>

              <p className={`text-base font-bold text-center break-keep ${
                visualAfter.status === 'danger' ? 'text-red-700' :
                visualAfter.status === 'warning' ? 'text-orange-700' :
                'text-blue-800'
              }`}>
                {visualAfter.message}
              </p>

              <button className="mt-2 p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors active:scale-[0.98] shadow-lg flex items-center justify-center gap-2">
                <span>이 방법으로 활동하기</span>
                <span className="text-xl">🙌</span>
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
