'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRecentMonths } from '@/utils/date'

interface Participant {
  id: string
  name: string
}

interface Props {
  participants: Participant[]
  initialParticipantId?: string
}

export default function EvaluationsPageClient({ participants, initialParticipantId }: Props) {
  const router = useRouter()
  const months = getRecentMonths(6)

  const [selectedParticipantId, setSelectedParticipantId] = useState(
    initialParticipantId || (participants[0]?.id ?? '')
  )
  const [selectedMonth, setSelectedMonth] = useState(months[0]?.value ?? '')

  // F-1: 당사자가 있으면 마운트 시 자동 이동
  useEffect(() => {
    const pid = initialParticipantId || participants[0]?.id
    const m = months[0]?.value
    if (pid && m) {
      router.push(`/supporter/evaluations/${pid}/${m}`)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleLoad() {
    if (!selectedParticipantId || !selectedMonth) return
    router.push(`/supporter/evaluations/${selectedParticipantId}/${selectedMonth}`)
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-black text-zinc-700 mb-1">월별 평가 작성 / 조회</h2>
        <p className="text-xs text-zinc-400">당사자와 월을 선택한 뒤 불러오기를 눌러 평가를 작성하거나 확인합니다.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">당사자</label>
          <select
            value={selectedParticipantId}
            onChange={e => setSelectedParticipantId(e.target.value)}
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
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-full p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-900 font-bold focus:ring-zinc-400 focus:outline-none"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 sm:w-36">
          <label className="text-xs font-black text-zinc-400 uppercase tracking-widest invisible">작업</label>
          <button
            onClick={handleLoad}
            disabled={!selectedParticipantId || !selectedMonth}
            className="w-full p-3 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📋 불러오기
          </button>
        </div>
      </div>
    </div>
  )
}
