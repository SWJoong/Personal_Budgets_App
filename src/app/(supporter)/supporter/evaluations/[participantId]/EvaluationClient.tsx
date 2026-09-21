'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recordMonitoring, updateMonitoring, deleteMonitoring } from '@/app/actions/monitoring'
import { monitoringHasContent } from '@/utils/monitoring'
import { unusedContext, type MonitoringRow, type TimelineEntry } from '@/utils/evaluationTimeline'
import { FormField } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/LiveRegion'
import { MoneyText } from '@/components/ui/MoneyText'
import { formatDate } from '@/utils/formatDate'

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

type MethodValue = 'visit' | 'phone' | 'app' | 'document'

export default function EvaluationClient({
  participantId,
  allocationId,
  timeline,
  monitoring,
  isAdmin = false,
}: {
  participantId: string
  allocationId: string | null
  timeline: TimelineEntry[]
  monitoring: MonitoringRow[]
  isAdmin?: boolean
}) {
  const router = useRouter()
  const { announce } = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [method, setMethod] = useState<MethodValue | null>(null)
  const [observedChange, setObservedChange] = useState('')
  const [participantVoice, setParticipantVoice] = useState('')

  // 수정 — 편집 중인 기록 id 와 편집 필드(내용 통째 교체). 삭제 — 확인 대기 id(2단계 확인).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMethod, setEditMethod] = useState<MethodValue | null>(null)
  const [editObserved, setEditObserved] = useState('')
  const [editVoice, setEditVoice] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function startEdit(m: MonitoringRow) {
    setConfirmDeleteId(null)
    setError('')
    setEditingId(m.id)
    setEditMethod((m.method as MethodValue) ?? null)
    setEditObserved(m.observedChange ?? '')
    setEditVoice(m.participantVoice ?? '')
  }

  function saveEdit(id: string) {
    if (!monitoringHasContent(editObserved, editVoice)) {
      const msg = '관찰한 내용이나 당사자의 말 중 하나는 적어 주세요.'
      setError(msg)
      announce(msg, 'assertive')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await updateMonitoring(id, {
        method: editMethod,
        observedChange: editObserved,
        participantVoice: editVoice,
      })
      if (result.error) {
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      setEditingId(null)
      announce('모니터링 기록을 고쳤어요.')
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    setError('')
    startTransition(async () => {
      const result = await deleteMonitoring(id)
      if (result.error) {
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      setConfirmDeleteId(null)
      announce('모니터링 기록을 지웠어요.')
      router.refresh()
    })
  }

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
                  editingId === entry.monitoring.id ? (
                    /* ── 인라인 수정 폼 ── */
                    <div className="p-4 rounded-2xl bg-card ring-2 ring-primary flex flex-col gap-3">
                      <span className="text-xs font-black text-primary uppercase tracking-widest">기록 고치기</span>
                      <div className="grid grid-cols-4 gap-2" role="group" aria-label="확인 방법">
                        {METHODS.map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            aria-pressed={editMethod === m.value}
                            onClick={() => setEditMethod(editMethod === m.value ? null : m.value)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl ring-2 transition-all min-h-[44px] ${
                              editMethod === m.value
                                ? 'ring-foreground bg-muted font-black'
                                : 'ring-border text-muted-foreground hover:ring-foreground'
                            }`}
                          >
                            <span className="text-lg" aria-hidden="true">{m.icon}</span>
                            <span className="text-[11px] font-bold">{m.label}</span>
                          </button>
                        ))}
                      </div>
                      <FormField id={`edit-observed-${entry.monitoring.id}`} label="실무자 관찰 (내가 본 변화)">
                        {(field) => (
                          <textarea
                            {...field}
                            value={editObserved}
                            onChange={(e) => setEditObserved(e.target.value)}
                            rows={3}
                            className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm resize-y"
                          />
                        )}
                      </FormField>
                      <FormField id={`edit-voice-${entry.monitoring.id}`} label="당사자의 말 (본인이 한 말 그대로)">
                        {(field) => (
                          <textarea
                            {...field}
                            value={editVoice}
                            onChange={(e) => setEditVoice(e.target.value)}
                            rows={3}
                            className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm resize-y"
                          />
                        )}
                      </FormField>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(entry.monitoring!.id)}
                          disabled={pending}
                          className="flex-1 p-2.5 rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:bg-hero-hover transition-colors disabled:opacity-50 min-h-[44px]"
                        >
                          {pending ? '저장하고 있어요...' : '저장'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={pending}
                          className="px-4 rounded-xl bg-muted text-muted-foreground font-bold text-sm hover:text-foreground transition-colors min-h-[44px]"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── 표시 + 수정·삭제 ── */
                    <div className="p-4 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground">
                          {entry.monitoring.method ? METHOD_LABEL[entry.monitoring.method] ?? '기록' : '기록'}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(entry.monitoring.monitoringDate)}</span>
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
                      {confirmDeleteId === entry.monitoring.id ? (
                        <div className="flex items-center gap-2 pt-2 mt-1 border-t border-border">
                          <span className="text-xs text-danger-fg font-bold flex-1">이 기록을 지울까요? 되돌릴 수 없어요.</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.monitoring!.id)}
                            disabled={pending}
                            className="px-3 min-h-[44px] rounded-lg bg-danger-bg text-danger-fg text-xs font-black hover:bg-danger-bg-hover transition-colors disabled:opacity-50"
                          >
                            지우기
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={pending}
                            className="px-3 min-h-[44px] rounded-lg bg-muted text-muted-foreground text-xs font-bold hover:text-foreground"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => startEdit(entry.monitoring!)}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
                          >
                            고치기
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null)
                                setConfirmDeleteId(entry.monitoring!.id)
                              }}
                              className="text-xs font-bold text-muted-foreground hover:text-danger-fg transition-colors min-h-[44px] px-2"
                            >
                              지우기
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}

                {entry.kind === 'settlement' && entry.settlement && (
                  <div className="p-4 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">정산</span>
                      <span className="text-xs text-muted-foreground">{entry.settlement.settledPeriod}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>받은 돈 <b><MoneyText value={entry.settlement.acceptedAmount} emphasis="muted" /></b></span>
                      <span>못 받은 돈 <MoneyText value={entry.settlement.rejectedAmount} emphasis="muted" /></span>
                      <span>환수 <MoneyText value={entry.settlement.recoveredAmount} emphasis="muted" /></span>
                      <span>미사용 <MoneyText value={entry.settlement.unusedAmount} emphasis="muted" /></span>
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
                      <span className="text-xs text-muted-foreground">{formatDate(entry.review.reviewDate)}</span>
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
