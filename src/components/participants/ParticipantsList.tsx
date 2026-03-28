'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BudgetAssignmentModal from './BudgetAssignmentModal'

interface Profile {
  id: string
  name: string
  role: string
}

interface Supporter {
  id: string
  name: string
}

interface FundingSource {
  id: string
  name: string
  monthly_budget: number
  current_month_balance: number
}

interface Participant {
  id: string
  name?: string
  supporter?: Supporter
  funding_sources?: FundingSource[]
  assigned_supporter_id?: string
}

interface ParticipantsListProps {
  participants: Participant[]
}

export default function ParticipantsList({ participants }: ParticipantsListProps) {
  const router = useRouter()
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)

  const handleAssignSupporter = (participant: Participant) => {
    setSelectedParticipant(participant)
    setIsAssignModalOpen(true)
  }

  const handleAssignSuccess = () => {
    setIsAssignModalOpen(false)
    setSelectedParticipant(null)
    router.refresh()
  }

  if (!participants || participants.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-50 border border-zinc-200 text-center">
        <span className="text-5xl mb-3 block">📋</span>
        <p className="text-zinc-500 font-medium">아직 등록된 당사자가 없습니다.</p>
        <p className="text-zinc-400 text-sm mt-1">위의 버튼을 눌러 당사자를 등록하세요.</p>
      </div>
    )
  }

  return (
    <>
      {participants.map((p: Participant) => {
        const totalBalance = (p.funding_sources || []).reduce(
          (acc: number, fs: FundingSource) => acc + Number(fs.current_month_balance),
          0
        )
        const totalBudget = (p.funding_sources || []).reduce(
          (acc: number, fs: FundingSource) => acc + Number(fs.monthly_budget),
          0
        )
        const percentage = totalBudget > 0 ? Math.round((totalBalance / totalBudget) * 100) : 0

        return (
          <div
            key={p.id}
            className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-lg font-bold text-zinc-600">
                  {(p.name || '?')[0]}
                </div>
                <div>
                  <p className="font-bold text-zinc-800">{p.name || '이름 없음'}</p>
                  <p className="text-xs text-zinc-400">
                    재원 {p.funding_sources?.length || 0}개 ·
                    담당: {p.supporter?.name || '미지정'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`text-lg font-black ${
                    percentage <= 20
                      ? 'text-red-600'
                      : percentage <= 40
                      ? 'text-orange-600'
                      : 'text-zinc-900'
                  }`}
                >
                  {percentage}%
                </p>
                <p className="text-[10px] text-zinc-400">이번 달</p>
              </div>
            </div>

            {/* 게이지 바 */}
            <div className="mt-4 h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentage <= 20
                    ? 'bg-red-500'
                    : percentage <= 40
                    ? 'bg-orange-500'
                    : 'bg-zinc-900'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* 액션 버튼 */}
            <div className="mt-5 pt-4 border-t border-zinc-50 flex gap-2">
              <Link
                href={`/admin/participants/${p.id}/preview`}
                className="flex-1 px-4 py-3 rounded-xl bg-amber-100 text-amber-700 text-sm font-black text-center hover:bg-amber-200 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>👁</span>
                <span>앱 미리보기</span>
              </Link>
              <button
                onClick={() => handleAssignSupporter(p)}
                className="px-4 py-3 rounded-xl bg-green-50 text-green-600 text-xs font-black text-center hover:bg-green-100 transition-all"
              >
                지원자 배정
              </button>
              <Link
                href={`/admin/participants/${p.id}`}
                className="px-4 py-3 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-black text-center hover:bg-zinc-200 transition-all"
              >
                상세 설정
              </Link>
            </div>
          </div>
        )
      })}

      {isAssignModalOpen && selectedParticipant && (
        <BudgetAssignmentModal
          participantId={selectedParticipant.id}
          participantName={selectedParticipant.name || '참여자'}
          currentSupporterId={selectedParticipant.assigned_supporter_id}
          onClose={() => {
            setIsAssignModalOpen(false)
            setSelectedParticipant(null)
          }}
          onSuccess={handleAssignSuccess}
        />
      )}
    </>
  )
}
