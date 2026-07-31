'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordMonitoring, type MonitoringRow } from '@/app/actions/monitoring'
import { recordSettlement, type SettlementRow } from '@/app/actions/settlement'
import { decideAppeal, type AppealRow } from '@/app/actions/appeal'
import { copayStatusLabel } from '@/utils/copay'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

const APPEAL_OUTCOME_LABEL: Record<string, string> = {
  pending: '확인 대기',
  upheld: '전부 반영',
  partially_upheld: '일부 반영',
  dismissed: '그대로 유지',
}

export default function ParticipantDetailClient({
  participantId,
  allocationId,
  allocatedAmount,
  copayAmount,
  copayStatus,
  monitoringRecords,
  settlements,
  appeals,
}: {
  participantId: string
  allocationId: string | null
  allocatedAmount: number | null
  copayAmount: number | null
  copayStatus: string | null
  monitoringRecords: MonitoringRow[]
  settlements: SettlementRow[]
  appeals: AppealRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [observedChange, setObservedChange] = useState('')
  const [participantVoice, setParticipantVoice] = useState('')

  const [settledPeriod, setSettledPeriod] = useState('')
  const [acceptedAmount, setAcceptedAmount] = useState('')
  const [unusedAmount, setUnusedAmount] = useState('')

  const [appealNotes, setAppealNotes] = useState<Record<string, string>>({})

  function handleAddMonitoring() {
    if (!observedChange.trim() && !participantVoice.trim()) {
      setError('관찰 내용이나 당사자의 말 중 하나는 적어주세요.')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await recordMonitoring({
        participantId,
        allocationId: allocationId || undefined,
        observedChange: observedChange.trim() || undefined,
        participantVoice: participantVoice.trim() || undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setObservedChange('')
      setParticipantVoice('')
      router.refresh()
    })
  }

  function handleAddSettlement() {
    if (!allocationId) {
      setError('예산 배정이 없어 정산을 등록할 수 없어요.')
      return
    }
    if (!settledPeriod.trim() || !acceptedAmount) {
      setError('정산 기간과 인정 금액을 입력해주세요.')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await recordSettlement({
        allocationId,
        settledPeriod: settledPeriod.trim(),
        acceptedAmount: Number(acceptedAmount),
        unusedAmount: unusedAmount ? Number(unusedAmount) : undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setSettledPeriod('')
      setAcceptedAmount('')
      setUnusedAmount('')
      router.refresh()
    })
  }

  function handleDecideAppeal(id: string, outcome: 'upheld' | 'partially_upheld' | 'dismissed') {
    setError('')
    startTransition(async () => {
      const result = await decideAppeal(id, { outcome, outcomeReason: appealNotes[id]?.trim() || undefined })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      {/* 예산·본인부담금 — 정산 때 청구할 금액이라 실무자가 먼저 확인해야 한다 */}
      {allocationId && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">예산과 본인부담금</h2>
          <div className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">승인금액</span>
              <span className="font-bold">{allocatedAmount !== null ? won(allocatedAmount) : '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">본인부담금</span>
              <span className="font-bold">{copayAmount !== null ? won(copayAmount) : '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">부담금 상태</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                copayStatus === 'unverified' ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-600'
              }`}>
                {copayStatusLabel(copayStatus)}
              </span>
            </div>
            {copayStatus === 'unverified' && (
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-3 leading-relaxed">
                공공부조 수급현황이 입력되지 않아 부과 기준으로 계산된 금액입니다.
                기초생활수급·차상위라면 면제 대상이니 수급현황을 먼저 확인해 주세요.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 이의신청 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">다시 봐달라는 요청</h2>
        {appeals.length === 0 ? (
          <p className="text-zinc-400 text-sm">아직 요청이 없어요.</p>
        ) : (
          appeals.map((a) => (
            <div key={a.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600">
                  {APPEAL_OUTCOME_LABEL[a.outcome] ?? a.outcome}
                </span>
                <span className="text-xs text-zinc-400">{a.filed_on}{a.due_on ? ` · 기한 ${a.due_on}` : ''}</span>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed">{a.ground}</p>
              {a.outcome === 'pending' && (
                <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100">
                  <input
                    type="text"
                    value={appealNotes[a.id] ?? ''}
                    onChange={(e) => setAppealNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    placeholder="결과 사유"
                    className="p-2 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleDecideAppeal(a.id, 'upheld')} disabled={pending}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 min-h-[36px]">전부 반영</button>
                    <button onClick={() => handleDecideAppeal(a.id, 'partially_upheld')} disabled={pending}
                      className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold disabled:opacity-50 min-h-[36px]">일부 반영</button>
                    <button onClick={() => handleDecideAppeal(a.id, 'dismissed')} disabled={pending}
                      className="flex-1 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-xs font-bold disabled:opacity-50 min-h-[36px]">그대로 유지</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* 모니터링 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">모니터링 기록</h2>
        {monitoringRecords.map((m) => (
          <div key={m.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-1">
            <span className="text-xs text-zinc-400">{m.monitoring_date}</span>
            {m.observed_change && <p className="text-sm text-zinc-700 leading-relaxed">관찰: {m.observed_change}</p>}
            {m.participant_voice && <p className="text-sm text-zinc-500 leading-relaxed">당사자: {m.participant_voice}</p>}
          </div>
        ))}
        <div className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 flex flex-col gap-2">
          <textarea
            value={observedChange}
            onChange={(e) => setObservedChange(e.target.value)}
            placeholder="실무자가 관찰한 변화"
            rows={2}
            className="p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none resize-none"
          />
          <textarea
            value={participantVoice}
            onChange={(e) => setParticipantVoice(e.target.value)}
            placeholder="당사자 본인이 한 말"
            rows={2}
            className="p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none resize-none"
          />
          <button onClick={handleAddMonitoring} disabled={pending}
            className="p-3 rounded-xl bg-zinc-900 text-white font-bold text-sm disabled:opacity-50 min-h-[44px]">
            기록 추가
          </button>
        </div>
      </section>

      {/* 정산 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">정산</h2>
        {settlements.map((s) => (
          <div key={s.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-1">
            <span className="font-bold text-sm">{s.settled_period}</span>
            <span className="text-xs text-zinc-500">
              인정 {won(s.accepted_amount)} · 반려 {won(s.rejected_amount)} · 환수 {won(s.recovered_amount)} · 미사용 {won(s.unused_amount)}
            </span>
            {s.note && <p className="text-xs text-zinc-400">{s.note}</p>}
          </div>
        ))}
        {!allocationId ? (
          <p className="text-zinc-400 text-sm">예산 배정이 없어 정산을 등록할 수 없어요.</p>
        ) : (
          <div className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 flex flex-col gap-2">
            <input
              type="text"
              value={settledPeriod}
              onChange={(e) => setSettledPeriod(e.target.value)}
              placeholder="정산 기간 (예: 2025-01~2025-06)"
              className="p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={acceptedAmount}
                onChange={(e) => setAcceptedAmount(e.target.value)}
                placeholder="인정 금액"
                className="flex-1 p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
              />
              <input
                type="number"
                value={unusedAmount}
                onChange={(e) => setUnusedAmount(e.target.value)}
                placeholder="미사용 금액"
                className="flex-1 p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
              />
            </div>
            <button onClick={handleAddSettlement} disabled={pending}
              className="p-3 rounded-xl bg-zinc-900 text-white font-bold text-sm disabled:opacity-50 min-h-[44px]">
              정산 등록
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
