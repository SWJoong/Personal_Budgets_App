'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordMonitoring, type MonitoringRow } from '@/app/actions/monitoring'
import { recordSettlement, type SettlementRow } from '@/app/actions/settlement'
import { decideAppeal, recordAppealDueDate, type AppealRow } from '@/app/actions/appeal'
import { copayStatusLabel, copayIntent } from '@/utils/copay'
import { MoneyText } from '@/components/ui/MoneyText'
import { StatusPill, type Intent } from '@/components/ui/StatusPill'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LinkButton } from '@/components/ui/LinkButton'

const APPEAL_OUTCOME_LABEL: Record<string, string> = {
  pending: '확인 대기',
  upheld: '전부 반영',
  partially_upheld: '일부 반영',
  dismissed: '그대로 유지',
}

// 이의신청 결과 → StatusPill intent(비색큐: 라벨이 1차 단서, 색은 보조).
// 전부 반영=확정된 좋은 결과(success) · 일부 반영=부분 반영 정보성(info) ·
// 그대로 유지=이의 기각 결과(neutral, 정당한 확정이라 빨강 아님) · 확인 대기=미결/주의(warning).
const APPEAL_OUTCOME_INTENT: Record<string, Intent> = {
  pending: 'warning',
  upheld: 'success',
  partially_upheld: 'info',
  dismissed: 'neutral',
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

  /** 심사처가 안내한 기한을 그대로 기록한다 — 앱이 계산하지 않는다 */
  function handleRecordDueDate(id: string, dueOn: string | null) {
    setError('')
    startTransition(async () => {
      const result = await recordAppealDueDate(id, dueOn)
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
        <Card as="div" variant="danger" className="text-sm">{error}</Card>
      )}

      {/* 당사자 화면 미리보기 진입 — 실무자가 당사자에게 보이는 화면을 확인한다(B4 진입점, P5 IA 도달성). */}
      <LinkButton href={`/admin/participants/${participantId}/preview`} variant="secondary" size="sm">
        <span aria-hidden="true">👁️</span>
        당사자 화면 미리보기
      </LinkButton>

      {/* 예산·본인부담금 — 정산 때 청구할 금액이라 실무자가 먼저 확인해야 한다 */}
      {allocationId && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest">예산과 본인부담금</h2>
          <Card as="div" variant="default" className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">승인금액</span>
              <span className="font-bold">{allocatedAmount !== null ? <MoneyText value={allocatedAmount} emphasis="body" /> : '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">본인부담금</span>
              <span className="font-bold">{copayAmount !== null ? <MoneyText value={copayAmount} emphasis="body" /> : '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">부담금 상태</span>
              <StatusPill label={copayStatusLabel(copayStatus)} intent={copayIntent(copayStatus)} />
            </div>
            {copayStatus === 'unverified' && (
              <Card as="div" variant="warning" className="text-[11px] leading-relaxed">
                공공부조 수급현황이 입력되지 않아 부과 기준으로 계산된 금액입니다.
                기초생활수급·차상위라면 면제 대상이니 수급현황을 먼저 확인해 주세요.
              </Card>
            )}
          </Card>
        </section>
      )}

      {/* 이의신청 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest">다시 봐달라는 요청</h2>
        {appeals.length === 0 ? (
          <EmptyState emoji="📭" title="아직 요청이 없어요." variant="inline" />
        ) : (
          <ul className="flex flex-col gap-3">
          {appeals.map((a) => (
            <Card key={a.id} as="li" variant="default" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <StatusPill
                  label={APPEAL_OUTCOME_LABEL[a.outcome] ?? a.outcome}
                  intent={APPEAL_OUTCOME_INTENT[a.outcome] ?? 'neutral'}
                />
                <span className="text-xs text-muted-foreground">{a.filed_on}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{a.ground}</p>

              {/* 기한은 심사처가 전달하는 값이라 앱이 계산하지 않는다. 비어 있으면
                  비어 있다고 보여주고 실무자가 안내받은 날짜를 그대로 적게 한다. */}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <label htmlFor={`appeal-due-${a.id}`} className="text-xs text-muted-foreground font-medium shrink-0">이의신청 기한</label>
                <input
                  id={`appeal-due-${a.id}`}
                  type="date"
                  defaultValue={a.due_on ?? ''}
                  onBlur={(e) => handleRecordDueDate(a.id, e.target.value || null)}
                  disabled={pending}
                  className="p-2 rounded-lg bg-muted ring-1 ring-border text-sm disabled:opacity-50"
                />
                {!a.due_on && (
                  <span className="text-[11px] text-warning-fg leading-relaxed">심사처 안내 확인 필요</span>
                )}
              </div>
              {a.outcome === 'pending' && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <input
                    type="text"
                    value={appealNotes[a.id] ?? ''}
                    onChange={(e) => setAppealNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    placeholder="결과 사유"
                    className="p-2 rounded-lg bg-muted ring-1 ring-border text-sm"
                  />
                  <div className="flex gap-2">
                    <Button variant="positive" size="sm" onClick={() => handleDecideAppeal(a.id, 'upheld')} disabled={pending} className="flex-1">전부 반영</Button>
                    <Button variant="warning" size="sm" onClick={() => handleDecideAppeal(a.id, 'partially_upheld')} disabled={pending} className="flex-1">일부 반영</Button>
                    <Button variant="secondary" size="sm" onClick={() => handleDecideAppeal(a.id, 'dismissed')} disabled={pending} className="flex-1">그대로 유지</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
          </ul>
        )}
      </section>

      {/* 모니터링 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest">모니터링 기록</h2>
        <ul className="flex flex-col gap-3">
        {monitoringRecords.map((m) => (
          <Card key={m.id} as="li" variant="default" className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{m.monitoring_date}</span>
            {m.observed_change && <p className="text-sm text-foreground leading-relaxed">관찰: {m.observed_change}</p>}
            {m.participant_voice && <p className="text-sm text-muted-foreground leading-relaxed">당사자: {m.participant_voice}</p>}
          </Card>
        ))}
        </ul>
        <Card as="div" variant="muted" className="flex flex-col gap-2">
          <textarea
            value={observedChange}
            onChange={(e) => setObservedChange(e.target.value)}
            placeholder="실무자가 관찰한 변화"
            rows={2}
            className="p-2 rounded-lg bg-card ring-1 ring-border text-sm resize-none"
          />
          <textarea
            value={participantVoice}
            onChange={(e) => setParticipantVoice(e.target.value)}
            placeholder="당사자 본인이 한 말"
            rows={2}
            className="p-2 rounded-lg bg-card ring-1 ring-border text-sm resize-none"
          />
          <Button variant="primary" onClick={handleAddMonitoring} disabled={pending} className="w-full">
            기록 추가
          </Button>
        </Card>
      </section>

      {/* 정산 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest">정산</h2>
        <ul className="flex flex-col gap-3">
        {settlements.map((s) => (
          <Card key={s.id} as="li" variant="default" className="flex flex-col gap-1">
            <span className="font-bold text-sm">{s.settled_period}</span>
            <span className="text-xs text-muted-foreground">
              인정 <MoneyText value={s.accepted_amount} emphasis="muted" /> · 반려 <MoneyText value={s.rejected_amount} emphasis="muted" /> · 환수 <MoneyText value={s.recovered_amount} emphasis="muted" /> · 미사용 <MoneyText value={s.unused_amount} emphasis="muted" />
            </span>
            {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
          </Card>
        ))}
        </ul>
        {!allocationId ? (
          <p className="text-muted-foreground text-sm">예산 배정이 없어 정산을 등록할 수 없어요.</p>
        ) : (
          <Card as="div" variant="muted" className="flex flex-col gap-2">
            <input
              type="text"
              value={settledPeriod}
              onChange={(e) => setSettledPeriod(e.target.value)}
              placeholder="정산 기간 (예: 2025-01~2025-06)"
              className="p-2 rounded-lg bg-card ring-1 ring-border text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={acceptedAmount}
                onChange={(e) => setAcceptedAmount(e.target.value)}
                placeholder="인정 금액"
                className="flex-1 p-2 rounded-lg bg-card ring-1 ring-border text-sm"
              />
              <input
                type="number"
                value={unusedAmount}
                onChange={(e) => setUnusedAmount(e.target.value)}
                placeholder="미사용 금액"
                className="flex-1 p-2 rounded-lg bg-card ring-1 ring-border text-sm"
              />
            </div>
            <Button variant="primary" onClick={handleAddSettlement} disabled={pending} className="w-full">
              정산 등록
            </Button>
          </Card>
        )}
      </section>
    </div>
  )
}
