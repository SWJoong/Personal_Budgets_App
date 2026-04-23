'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getRecentMonths } from '@/utils/date'

interface Participant {
  id: string
  name: string
}

interface Props {
  participants: Participant[]
  initialParticipantId?: string
  initialMonth?: string
}

export default function EvaluationsPageClient({
  participants,
  initialParticipantId,
  initialMonth,
}: Props) {
  const router = useRouter()
  const months = getRecentMonths(6)

  const [selectedParticipantId, setSelectedParticipantId] = useState(
    initialParticipantId || (participants[0]?.id ?? '')
  )
  const [selectedMonth, setSelectedMonth] = useState(
    initialMonth || (months[0]?.value ?? '')
  )

  // 드롭다운 변경 시 같은 페이지에서 searchParams만 업데이트
  function handleParticipantChange(newId: string) {
    setSelectedParticipantId(newId)
    router.push(`/supporter/evaluations?participant_id=${newId}&month=${selectedMonth}`)
  }

  function handleMonthChange(newMonth: string) {
    setSelectedMonth(newMonth)
    if (selectedParticipantId) {
      router.push(`/supporter/evaluations?participant_id=${selectedParticipantId}&month=${newMonth}`)
    }
  }

  // 상세 페이지로 이동 (평가 작성/편집 시)
  function handleOpenDetail() {
    if (!selectedParticipantId || !selectedMonth) return
    router.push(`/supporter/evaluations/${selectedParticipantId}/${selectedMonth}`)
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-black text-zinc-700 mb-1">월별 평가 작성 / 조회</h2>
        <p className="text-xs text-zinc-400">당사자와 월을 선택하면 아래에서 바로 평가 내용을 확인할 수 있습니다.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">당사자</label>
          <select
            value={selectedParticipantId}
            onChange={e => handleParticipantChange(e.target.value)}
            className="w-full p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-bold focus:ring-zinc-400 focus:outline-none"
          >
            {participants.length === 0 ? (
              <option value="">담당 당사자 없음</option>
            ) : (
              participants.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1 sm:w-48">
          <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">월</label>
          <select
            value={selectedMonth}
            onChange={e => handleMonthChange(e.target.value)}
            className="w-full p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-bold focus:ring-zinc-400 focus:outline-none"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

      </div>
    </div>
  )
}
