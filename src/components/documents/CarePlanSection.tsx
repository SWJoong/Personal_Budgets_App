"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { CarePlanType } from '@/types/care-plans'
import { CARE_PLAN_LABELS, CARE_PLAN_DESCRIPTIONS } from '@/types/care-plans'
import { getSupportGoals } from '@/app/actions/supportGoal'
import type { SupportGoal } from '@/app/actions/supportGoal'

interface CarePlanSummary {
  id: string
  participant_id: string
  plan_type: string
  plan_year: number
  updated_at: string
  content?: any
}

interface Participant {
  id: string
  name?: string
}

interface Props {
  selectedParticipantId: string
  selectedParticipantName?: string
  selectedYear: number
  carePlans: CarePlanSummary[]
}

const PLAN_TYPES: CarePlanType[] = ['mohw_plan', 'seoul_plan']
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR + 1]

const GOALS_LABEL = '지원목표·예산 계획'
const GOALS_DESCRIPTION = '연간 지원 목표 및 예산 세목 (산출내역)'

function formatPreview(planType: CarePlanType, content: any): string {
  if (!content) return '내용이 없습니다.'
  try {
    if (planType === 'seoul_plan') {
      return `[원하는 삶의 모습]\n${content.desired_life || '-'}\n\n[장애로 인한 어려움]\n${content.difficulties || '-'}\n\n[시도하고 싶은 것]\n${content.trial_goals || '-'}`
    } else if (planType === 'mohw_plan') {
      return `[개인예산 이용계획 목표]\n${content.plan_goal || '-'}\n\n[현재 일상생활]\n${content.daily_routine || '-'}`
    }
  } catch (e) {
    return '내용을 불러올 수 없습니다.'
  }
  return '내용이 없습니다.'
}

export default function CarePlanSection({ selectedParticipantId, selectedParticipantName, selectedYear, carePlans }: Props) {
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [goals, setGoals] = useState<SupportGoal[] | null>(null)
  const [isLoadingGoals, setIsLoadingGoals] = useState(false)

  useEffect(() => {
    setOpenDetails({})
    setGoals(null)
  }, [selectedParticipantId, selectedYear])

  function findPlan(planType: CarePlanType) {
    return carePlans.find(
      p => p.participant_id === selectedParticipantId &&
           p.plan_type === planType &&
           p.plan_year === selectedYear
    )
  }

  if (!selectedParticipantId) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-50 text-center text-sm text-zinc-400">
        당사자를 선택해주세요.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* 이용계획서 카드 목록 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLAN_TYPES.map((planType) => {
          const existing = findPlan(planType)
          const href = `/supporter/documents/care-plans/${selectedParticipantId}/${planType}?year=${selectedYear}`

          return (
            <div
              key={planType}
              className={`p-5 rounded-2xl ring-1 transition-all ${
                existing ? 'bg-white ring-green-200' : 'bg-white ring-zinc-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-black text-zinc-900 text-sm">{CARE_PLAN_LABELS[planType]}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{CARE_PLAN_DESCRIPTIONS[planType]}</p>
                </div>
                {existing ? (
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold shrink-0">저장됨</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-400 text-[10px] font-bold shrink-0">미작성</span>
                )}
              </div>

              {existing && (
                <p className="text-[10px] text-zinc-400 mb-3">
                  최종 수정: {new Date(existing.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}

              <div className="flex gap-2">
                {existing && (
                  <button
                    onClick={() => setOpenDetails(prev => ({ ...prev, [planType]: !prev[planType] }))}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black text-zinc-600 bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 transition-all active:scale-95"
                  >
                    {openDetails[planType] ? '세부내용 접기 ▲' : '세부내용 펼쳐보기 ▼'}
                  </button>
                )}
                <Link
                  href={href}
                  className={`block flex-1 py-2.5 rounded-xl text-sm font-black text-center transition-all active:scale-95 ${
                    existing
                      ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      : 'bg-zinc-900 text-white hover:bg-zinc-700'
                  }`}
                >
                  {existing ? '수정하기' : '작성하기'}
                </Link>
              </div>

              {existing && openDetails[planType] && (
                <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-2 duration-200">
                  {formatPreview(planType, existing.content)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 지원목표·예산 카드 */}
      {(() => {
        const hasCarePlan = PLAN_TYPES.some(pt => findPlan(pt))
        const existingPlanForGoals = findPlan('mohw_plan') || findPlan('seoul_plan')
        const goalsHref = `/supporter/evaluations/${selectedParticipantId}/goals`

        const handleToggleGoals = async () => {
          if (openDetails['goals']) {
            setOpenDetails(prev => ({ ...prev, goals: false }))
            return
          }
          if (!goals && existingPlanForGoals) {
            setIsLoadingGoals(true)
            try {
              const fetched = await getSupportGoals(existingPlanForGoals.id)
              setGoals(fetched)
            } catch (e) {}
            setIsLoadingGoals(false)
          }
          setOpenDetails(prev => ({ ...prev, goals: true }))
        }

        return (
          <div className={`p-5 rounded-2xl ring-1 transition-all ${
            hasCarePlan ? 'bg-white ring-violet-200' : 'bg-white ring-zinc-200'
          }`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-black text-zinc-900 text-sm">{GOALS_LABEL}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{GOALS_DESCRIPTION}</p>
              </div>
              {hasCarePlan ? (
                <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold shrink-0">계획서 연결됨</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-400 text-[10px] font-bold shrink-0">계획서 필요</span>
              )}
            </div>
            {!hasCarePlan && (
              <p className="text-[10px] text-amber-600 mb-3">
                이용계획서를 먼저 작성하면 지원 목표를 연결할 수 있어요.
              </p>
            )}

            <div className="flex gap-2 mt-3">
              {hasCarePlan && (
                <button
                  onClick={handleToggleGoals}
                  disabled={isLoadingGoals}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black text-zinc-600 bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isLoadingGoals ? '불러오는 중...' : openDetails['goals'] ? '세부내용 접기 ▲' : '세부내용 펼쳐보기 ▼'}
                </button>
              )}
              <Link
                href={goalsHref}
                className={`block flex-1 py-2.5 rounded-xl text-sm font-black text-center transition-all active:scale-95 ${
                  hasCarePlan
                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {hasCarePlan ? '지원목표 관리' : '관리하기'}
              </Link>
            </div>

            {hasCarePlan && openDetails['goals'] && (
              <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-2 duration-200">
                {!goals ? (
                  '내용을 불러오지 못했습니다.'
                ) : goals.length === 0 ? (
                  '등록된 지원 목표가 없습니다.'
                ) : (
                  goals.map((g, i) => (
                    <div key={g.id} className="mb-3 last:mb-0">
                      <p className="font-bold text-zinc-900 mb-1">{i + 1}. {g.support_area}</p>
                      {g.outcome_goal && <p className="text-zinc-600 ml-3">- 목표: {g.outcome_goal}</p>}
                      {g.strategy && <p className="text-zinc-600 ml-3">- 전략: {g.strategy}</p>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })()}

      {selectedParticipantName && (
        <p className="text-xs text-zinc-400 text-center mt-1">
          {selectedParticipantName} 님의 {selectedYear}년 이용계획서
        </p>
      )}
    </div>
  )
}
