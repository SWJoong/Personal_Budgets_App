'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { MapTransaction } from '@/components/map/KakaoMap'

const KakaoMap = dynamic(() => import('@/components/map/KakaoMap'), { ssr: false })

interface Participant {
  id: string
  name: string
}

interface Props {
  apiKey: string
  transactions: (MapTransaction & { participant_id: string })[]
  participants: Participant[]
}

export default function MapPageClient({ apiKey, transactions, participants }: Props) {
  const [participantId, setParticipantId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (participantId && t.participant_id !== participantId) return false
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo && t.date > dateTo) return false
      if (status && t.status !== status) return false
      return true
    })
  }, [transactions, participantId, dateFrom, dateTo, status])

  const hasFilter = !!(participantId || dateFrom || dateTo || status)

  function clearFilters() {
    setParticipantId('')
    setDateFrom('')
    setDateTo('')
    setStatus('')
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-white ring-1 ring-zinc-200">
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">당사자</label>
          <select
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold focus:ring-zinc-900 focus:outline-none"
          >
            <option value="">전체</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">시작 날짜</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold focus:ring-zinc-900 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">종료 날짜</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold focus:ring-zinc-900 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">상태</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm font-bold focus:ring-zinc-900 focus:outline-none"
          >
            <option value="">전체</option>
            <option value="confirmed">승인됨</option>
            <option value="pending">검토중</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-bold text-zinc-500">
            {filtered.length}건 표시
          </span>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 rounded-xl bg-zinc-100 text-zinc-600 font-bold text-sm hover:bg-zinc-200 transition-colors"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      <KakaoMap apiKey={apiKey} transactions={filtered} height="calc(100vh - 280px)" />
    </div>
  )
}
