'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recordMonitoring } from '@/app/actions/monitoring'
import { unusedContext, type MonitoringRow, type TimelineEntry } from '@/utils/evaluationTimeline'
import { FormField } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/LiveRegion'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

const METHODS: { value: 'visit' | 'phone' | 'app' | 'document'; label: string; icon: string }[] = [
  { value: 'visit', label: '방문', icon: '🏠' },
  { value: 'phone', label: '전화', icon: '📞' },
  { value: 'app', label: '앱', icon: '📱' },
  { value: 'document', label: '서류', icon: '📄' },
]
const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHODS.map((m) => [m.value, `${m.icon} ${m.label}`]))

const DECISION_LABEL: Record<string, string> = {
  approved: '승인',
  conditional: '조건부 승인',
  rejected: '반려',
}

export default function EvaluationClient({
  participantId,
  allocationId,
  timeline,
  monitoring,
}: {
  participantId: string
  allocationId: string | null
  timeline: TimelineEntry[]
  monitoring: MonitoringRow[]
}) {
  const router = useRouter()
  const { announce } = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [method, setMethod] = useState<'visit' | 'phone' | 'app' | 'document' | null>(null)
  const [observedChange, setObservedChange] = useState('')
  const [participantVoice, setParticipantVoice] = useState('')

  function handleRecord() {
    if (!observedChange.trim() && !participantVoice.trim()) {
      const msg = '관찰한 내용이나 당사자의 말 중 하나는 적어 주세요.'
      setError(msg)
      announce(msg, 'assertive')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await recordMonitoring({
        participantId,
        allocationId: allocationId || undefined,
        method: method || undefined,
        observedChange: observedChange.trim() || undefined,
        participantVoice: participantVoice.trim() || undefined,
      })
      if (result.error) {
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      setMethod(null)
      setObservedChange('')
      setParticipantVoice('')
      announce('모니터링 기록을 저장했어요.')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium leading-relaxed">
          {error}
        </div>
      )}

      {/* 새 모니터링 기록 — recordMonitoring 소비(설계 §5). observed/voice 별도 칸 강제. */}
      <section className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-4">
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest">새 모니터링 기록</h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-bold text-muted-foreground mb-2">어떻게 확인했나요?</legend>
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={method === m.value}
                onClick={() => setMethod(method === m.value ? null : m.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl ring-2 transition-all ${
                  method === m.value
                    ? 'ring-foreground bg-muted font-black'
                    : 'ring-border text-muted-foreground hover:ring-foreground'
                }`}
              >
                <span className="text-xl">{m.icon}</span>
                <span className="text-xs font-bold">{m.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <FormField id="observed-change" label="실무자 관찰 (내가 본 변화)">
          {(field) => (
            <textarea
              {...field}
              value={observedChange}
              onChange={(e) => setObservedChange(e.target.value)}
              placeholder="예: 표정이 밝아지고 먼저 인사를 건넸다"
              rows={3}
              className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm resize-y"
            />
          )}
        </FormField>

        <FormField id="participant-voice" label="당사자의 말 (본인이 한 말 그대로)">
          {(field) => (
            <textarea
              {...field}
              value={participantVoice}
              onChange={(e) => setParticipantVoice(e.target.value)}
              placeholder="당사자가 한 말을 그대로 적어요"
              rows={3}
              className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm resize-y"
            />
          )}
        </FormField>

        <button
          type="button"
          onClick={handleRecord}
          disabled={pending}
          className="p-3 rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:bg-hero-hover transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {pending ? '저장하고 있어요...' : '기록하기'}
        </button>
      </section>

      {/* 타임라인 — 모니터링·정산·심의를 날짜순으로(buildEvaluationTimeline). 정산 미사용은 관련 모니터링 발췌를 곁들인다. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest">기록 타임라인</h2>
        {timeline.length === 0 ? (
          <div className="p-8 rounded-2xl bg-muted text-center">
            <p className="text-muted-foreground font-medium leading-relaxed">
              아직 확인한 기록이 없어요.<br />처음 방문·통화 후 기록해 보세요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {timeline.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`}>
                {entry.kind === 'monitoring' && entry.monitoring && (
                  <div className="p-4 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">
                        {entry.monitoring.method ? METHOD_LABEL[entry.monitoring.method] ?? '기록' : '기록'}
                      </span>
                      <span className="text-xs text-muted-foreground">{entry.monitoring.monitoringDate}</span>
                    </div>
                    {entry.monitoring.observedChange && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        <span className="font-bold text-muted-foreground">관찰 </span>
                        {entry.monitoring.observedChange}
                      </p>
                    )}
                    {entry.monitoring.participantVoice && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        <span className="font-bold text-muted-foreground">당사자 말 </span>
                        {entry.monitoring.participantVoice}
                      </p>
                    )}
                    {!entry.monitoring.allocationId && (
                      <span className="text-[11px] text-muted-foreground">배정 전 기록</span>
                    )}
                  </div>
                )}

                {entry.kind === 'settlement' && entry.settlement && (
                  <div className="p-4 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">정산</span>
                      <span className="text-xs text-muted-foreground">{entry.settlement.settledPeriod}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>받은 돈 <b>{won(entry.settlement.acceptedAmount)}</b></span>
                      <span>못 받은 돈 {won(entry.settlement.rejectedAmount)}</span>
                      <span>환수 {won(entry.settlement.recoveredAmount)}</span>
                      <span>미사용 {won(entry.settlement.unusedAmount)}</span>
                    </div>
                    {entry.settlement.unusedAmount > 0 && (() => {
                      const context = unusedContext(entry.settlement!, monitoring)
                      return context ? (
                        <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3 leading-relaxed">
                          관련 모니터링: “{context}”
                        </p>
                      ) : (
                        <span className="text-[11px] text-warning-fg bg-warning-bg rounded-lg px-2.5 py-1 self-start">
                          미사용 이유 확인 필요
                        </span>
                      )
                    })()}
                  </div>
                )}

                {entry.kind === 'review' && entry.review && (
                  <div className="p-4 rounded-2xl bg-muted ring-1 ring-border flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">심의 {DECISION_LABEL[entry.review.decision] ?? entry.review.decision}</span>
                      <span className="text-xs text-muted-foreground">{entry.review.reviewDate}</span>
                    </div>
                    {entry.review.reason && (
                      <p className="text-sm text-muted-foreground leading-relaxed">사유: {entry.review.reason}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 길목 — 예산·지출 화면으로 (budgets/[id] 는 participant_id 그레인) */}
      <section className="flex gap-2">
        <Link
          href={`/supporter/budgets/${participantId}`}
          className="flex-1 p-3 rounded-xl bg-card ring-1 ring-border text-center text-sm font-bold text-muted-foreground hover:ring-foreground transition-all min-h-[44px] flex items-center justify-center"
        >
          예산 보기
        </Link>
        <Link
          href={`/supporter/${participantId}/transactions/new`}
          className="flex-1 p-3 rounded-xl bg-card ring-1 ring-border text-center text-sm font-bold text-muted-foreground hover:ring-foreground transition-all min-h-[44px] flex items-center justify-center"
        >
          지출 기록
        </Link>
      </section>
    </div>
  )
}
