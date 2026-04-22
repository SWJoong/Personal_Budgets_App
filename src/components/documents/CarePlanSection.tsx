"use client"

import { useState } from 'react'
import Link from 'next/link'
import type { CarePlanType } from '@/types/care-plans'
import { CARE_PLAN_LABELS, CARE_PLAN_DESCRIPTIONS } from '@/types/care-plans'

interface CarePlanSummary {
  id: string
  participant_id: string
  plan_type: string
  plan_year: number
  updated_at: string
}

interface Participant {
  id: string
  name?: string
}

interface Props {
  participants: Participant[]
  carePlans: CarePlanSummary[]
}

const PLAN_TYPES: CarePlanType[] = ['mohw_plan', 'seoul_plan']
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR + 1]

const GOALS_LABEL = '지원목표·예산 계획'
const GOALS_DESCRIPTION = '연간 지원 목표 및 예산 세목 (산출내역)'

export default function CarePlanSection({ participants, carePlans }: Props) {
  const [selectedParticipantId, setSelectedParticipantId] = useState(participants[0]?.id ?? '')
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)

  const selectedParticipant = participants.find(p => p.id === selectedParticipantId)

  function findPlan(planType: CarePlanType) {
    return carePlans.find(
      p => p.participant_id === selectedParticipantId &&
           p.plan_type === planType &&
           p.plan_year === selectedYear
    )
  }

  if (participants.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-50 text-center text-sm text-zinc-400">
        담당 당사자가 없습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 + 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedParticipantId}
          onChange={e => setSelectedParticipantId(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white ring-1 ring-zinc-200 text-sm font-bold focus:ring-zinc-900 focus:outline-none"
        >
          {participants.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="px-3 py-2 rounded-xl bg-white ring-1 ring-zinc-200 text-sm font-bold focus:ring-zinc-900 focus:outline-none"
        >
          {YEAR_OPTIONS.map(y => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </div>

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

              <Link
                href={href}
                className={`block w-full py-2.5 rounded-xl text-sm font-black text-center transition-all active:scale-95 ${
                  existing
                    ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    : 'bg-zinc-900 text-white hover:bg-zinc-700'
                }`}
              >
                {existing ? '수정하기' : '작성하기'}
              </Link>
            </div>
          )
        })}
      </div>

      {/* 지원목표·예산 카드 */}
      {(() => {
        const hasCarePlan = PLAN_TYPES.some(pt => findPlan(pt))
        const goalsHref = `/supporter/evaluations/${selectedParticipantId}/goals`
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
            <Link
              href={goalsHref}
              className={`block w-full py-2.5 rounded-xl text-sm font-black text-center transition-all active:scale-95 ${
                hasCarePlan
                  ? 'bg-violet-600 text-white hover:bg-violet-700'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
            >
              {hasCarePlan ? '지원목표 관리' : '관리하기'}
            </Link>
          </div>
        )
      })()}

      {selectedParticipant && (
        <p className="text-xs text-zinc-400 text-center mt-1">
          {selectedParticipant.name} 님의 {selectedYear}년 이용계획서
        </p>
      )}
    </div>
  )
}
