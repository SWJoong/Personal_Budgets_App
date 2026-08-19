'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  reviewRequestedService,
  upsertSelfNarrative,
  upsertRequestedService,
  deleteRequestedService,
  submitUtilizationPlan,
} from '@/app/actions/utilizationPlan'
import {
  decidePlanReview,
  sendNotification,
  createReviewCommittee,
  type ReviewCommitteeRow,
} from '@/app/actions/planReview'

interface SelfNarrative {
  strengths_talents: string | null
  social_barriers: string | null
  desired_change: string | null
  desired_life: string | null
  goal_to_try: string | null
}

interface RequestedService {
  id: string
  priority: number
  service_name: string
  estimated_cost: number | null
  approved_for_service: boolean | null
  review_note: string | null
}

interface PlanReview {
  id: string
  decision: 'approved' | 'conditional' | 'rejected'
  reason: string | null
}

interface NotificationRecord {
  id: string
  method: string | null
  is_read_by_participant: boolean
}

const STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  submitted: '제출됨 — 심의 대기',
  under_review: '심의 중',
  approved: '승인됨',
  conditional: '조건부 승인',
  rejected: '반려됨',
  under_appeal: '이의신청 중',
}

const NARRATIVE_FIELDS: { key: keyof SelfNarrative; label: string }[] = [
  { key: 'strengths_talents', label: '나의 재능, 강점, 기술' },
  { key: 'social_barriers', label: '장애로 인해 겪는 사회적 제한, 삶에서의 어려움' },
  { key: 'desired_change', label: '내가 원하는 변화와 지원' },
  { key: 'desired_life', label: '내가 원하는 삶의 모습' },
  { key: 'goal_to_try', label: '시도하고 싶은 것' },
]

export default function PlanDetailClient({
  planId,
  participantId,
  status,
  isAdmin,
  narrative,
  requestedServices,
  latestReview,
  notification,
  committees,
}: {
  planId: string
  participantId: string
  status: string
  isAdmin: boolean
  narrative: SelfNarrative | null
  requestedServices: RequestedService[]
  latestReview: PlanReview | null
  notification: NotificationRecord | null
  committees: ReviewCommitteeRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [committeeId, setCommitteeId] = useState('')
  const [newCommitteeName, setNewCommitteeName] = useState('')
  const [newCommitteeNote, setNewCommitteeNote] = useState('')

  // 작성 중(draft)일 때 담당자가 채우는 값들.
  const isDraft = status === 'draft'
  const [form, setForm] = useState<SelfNarrative>({
    strengths_talents: narrative?.strengths_talents ?? '',
    social_barriers: narrative?.social_barriers ?? '',
    desired_change: narrative?.desired_change ?? '',
    desired_life: narrative?.desired_life ?? '',
    goal_to_try: narrative?.goal_to_try ?? '',
  })
  const [services, setServices] = useState<{ id: string | null; serviceName: string; estimatedCost: string }[]>(
    [1, 2, 3].map((priority) => {
      const existing = requestedServices.find((s) => s.priority === priority)
      return {
        id: existing?.id ?? null,
        serviceName: existing?.service_name ?? '',
        estimatedCost: existing?.estimated_cost?.toString() ?? '',
      }
    })
  )

  /** 나의 상황 + 요청 서비스 저장. 실패하면 첫 에러 메시지를 돌려준다(성공이면 undefined). */
  async function saveNarrativeAndServices(): Promise<string | undefined> {
    const narrativeResult = await upsertSelfNarrative({ planId, ...form })
    if (narrativeResult.error) return narrativeResult.error

    for (let i = 0; i < services.length; i++) {
      const s = services[i]
      if (!s.serviceName.trim()) {
        // 비운 칸에 예전 내용이 있으면 지운다 — 안 그러면 화면은 비었는데 값이 남는다.
        if (s.id) {
          const result = await deleteRequestedService(s.id)
          if (result.error) return result.error
        }
        continue
      }
      const result = await upsertRequestedService({
        planId,
        priority: i + 1,
        serviceName: s.serviceName.trim(),
        estimatedCost: s.estimatedCost ? Number(s.estimatedCost) : undefined,
      })
      if (result.error) return result.error
    }
    return undefined
  }

  function handleSaveDraft() {
    setError('')
    startTransition(async () => {
      const saveError = await saveNarrativeAndServices()
      if (saveError) {
        setError(saveError)
        return
      }
      router.refresh()
    })
  }

  /**
   * 제출 전에 반드시 먼저 저장한다. 그렇지 않으면 화면에 입력해 둔 내용이 서버에
   * 없는 채로 상태만 submitted 로 바뀌고, 그 순간부터 RLS 가 이후 수정을 다르게
   * 취급해 입력한 내용이 사라질 수 있다.
   */
  function handleSubmitPlan() {
    setError('')
    startTransition(async () => {
      const saveError = await saveNarrativeAndServices()
      if (saveError) {
        setError(saveError)
        return
      }
      const result = await submitUtilizationPlan(planId)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  /** 심사처에서 전달받은 심의 주체를 기록한다 — 구성의 유효성은 판단하지 않는다 */
  function handleCreateCommittee() {
    setError('')
    startTransition(async () => {
      const result = await createReviewCommittee({
        name: newCommitteeName,
        compositionNote: newCommitteeNote || undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.committeeId) setCommitteeId(result.committeeId)
      setNewCommitteeName('')
      setNewCommitteeNote('')
      router.refresh()
    })
  }

  function handleReviewService(id: string, approvedForService: boolean) {
    if (!approvedForService && !window.confirm('정말 이 서비스 항목을 반려할까요?')) return
    setError('')
    startTransition(async () => {
      const result = await reviewRequestedService(id, {
        approvedForService,
        reviewNote: reviewNotes[id]?.trim() || undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDecide(decision: 'approved' | 'conditional' | 'rejected') {
    if (decision !== 'approved' && !reason.trim()) {
      setError('승인이 아닌 경우 사유를 반드시 입력해야 해요.')
      return
    }
    if (decision === 'rejected' && !window.confirm('정말 반려로 결정할까요? 결정 뒤에는 스스로 바꿀 수 없어요.')) {
      return
    }
    setError('')
    startTransition(async () => {
      const result = await decidePlanReview({
        planId,
        decision,
        reason: reason.trim() || undefined,
        committeeId: committeeId || undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleSendNotification() {
    if (!latestReview) return
    setError('')
    startTransition(async () => {
      const result = await sendNotification({ reviewId: latestReview.id, participantId, method: 'app' })
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
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium leading-relaxed">
          {error}
        </div>
      )}

      <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">계획 상태</span>
        <p className="font-bold mt-1">{STATUS_LABEL[status] ?? status}</p>
      </section>

      {/* 작성 중(draft)이면 담당자가 여기서 나의 상황·요청 서비스를 채운다.
          당사자와 함께 면담하며 담당자가 대신 적는다(기관 확인). 제출 뒤에는 읽기 전용. */}
      <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-3">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">나의 상황</span>
        {isDraft ? (
          NARRATIVE_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400 font-medium">{label}</label>
              <textarea
                value={form[key] ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="당사자와 함께 이야기한 내용을 적어주세요"
                rows={2}
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm leading-relaxed focus:ring-zinc-400 focus:outline-none resize-none"
              />
            </div>
          ))
        ) : narrative ? (
          NARRATIVE_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-xs text-zinc-400 font-medium">{label}</span>
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{narrative[key] || '—'}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-400">아직 작성되지 않았어요.</p>
        )}
      </section>

      <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-3">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">요청 서비스</span>
        {isDraft ? (
          services.map((s, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1 flex flex-col gap-0.5">
                <label className="text-[10px] text-zinc-400 font-medium">{i + 1}순위 — 무엇에 쓰나요?</label>
                <input
                  type="text"
                  value={s.serviceName}
                  onChange={(e) => {
                    const next = [...services]
                    next[i] = { ...next[i], serviceName: e.target.value }
                    setServices(next)
                  }}
                  placeholder="예: 웹툰 학원 수강"
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                />
              </div>
              <div className="w-28 flex flex-col gap-0.5">
                <label className="text-[10px] text-zinc-400 font-medium">예상 금액 (원)</label>
                <input
                  type="number"
                  value={s.estimatedCost}
                  onChange={(e) => {
                    const next = [...services]
                    next[i] = { ...next[i], estimatedCost: e.target.value }
                    setServices(next)
                  }}
                  placeholder="0"
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                />
              </div>
            </div>
          ))
        ) : requestedServices.length === 0 ? (
          <p className="text-sm text-zinc-400">아직 작성되지 않았어요.</p>
        ) : (
          requestedServices.map((rs) => (
            <div key={rs.id} className="p-4 rounded-xl bg-zinc-50 ring-1 ring-zinc-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{rs.priority}순위 · {rs.service_name}</span>
                {rs.estimated_cost != null && (
                  <span className="text-xs text-zinc-400">{Math.round(rs.estimated_cost).toLocaleString('ko-KR')}원</span>
                )}
              </div>
              {rs.approved_for_service === null ? (
                (status === 'submitted' || status === 'under_review') && (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={reviewNotes[rs.id] ?? ''}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [rs.id]: e.target.value }))}
                      placeholder="검토 의견 (선택)"
                      className="p-2 rounded-lg bg-white ring-1 ring-zinc-200 text-xs focus:ring-zinc-400 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewService(rs.id, true)}
                        disabled={pending}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 min-h-[36px]"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleReviewService(rs.id, false)}
                        disabled={pending}
                        className="flex-1 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-300 disabled:opacity-50 min-h-[36px]"
                      >
                        반려
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <span className={`text-xs font-bold ${rs.approved_for_service ? 'text-emerald-600' : 'text-red-600'}`}>
                  {rs.approved_for_service ? '승인됨' : '반려됨'}{rs.review_note ? ` — ${rs.review_note}` : ''}
                </span>
              )}
            </div>
          ))
        )}
      </section>

      {/* 작성 중일 때만 저장·제출. 제출하면 심의 대기(submitted)로 넘어간다. */}
      {isDraft && (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={pending}
            className="p-3 rounded-xl bg-white ring-1 ring-zinc-300 text-zinc-700 font-bold text-sm disabled:opacity-50 min-h-[44px]"
          >
            저장하기
          </button>
          <button
            onClick={handleSubmitPlan}
            disabled={pending}
            className="p-3 rounded-xl bg-zinc-900 text-white font-bold text-sm disabled:opacity-50 min-h-[44px]"
          >
            제출하기 (심의 요청)
          </button>
        </div>
      )}

      {isAdmin && (
        <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-4">
          <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">심의 결과</span>
          {latestReview ? (
            <div className="flex flex-col gap-1">
              <span className="font-bold">{STATUS_LABEL[latestReview.decision] ?? latestReview.decision}</span>
              {latestReview.reason && <p className="text-sm text-zinc-500 leading-relaxed">{latestReview.reason}</p>}
            </div>
          ) : status === 'submitted' || status === 'under_review' ? (
            <>
              {/* 누가 심의했는지 기록한다. 구성·정족수가 유효한지는 앱이 판단하지
                  않는다 — 심사처가 전달한 내용을 그대로 남기는 칸이다. */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-medium">심의 주체</label>
                <select
                  value={committeeId}
                  onChange={(e) => setCommitteeId(e.target.value)}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                >
                  <option value="">기록 안 함</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {committees.length === 0 && (
                  <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                    등록된 심의 주체가 없어요. 심사처에서 전달받은 구성을 아래에 적어 두면
                    이후 심의에서 고를 수 있어요.
                  </p>
                )}
                <details className="mt-1">
                  <summary className="text-[11px] text-zinc-500 cursor-pointer min-h-[32px] flex items-center">
                    + 심의 주체 새로 기록하기
                  </summary>
                  <div className="flex flex-col gap-2 pt-2">
                    <input
                      type="text"
                      value={newCommitteeName}
                      onChange={(e) => setNewCommitteeName(e.target.value)}
                      placeholder="심의 주체 이름 (예: 2026년 3차 심의위원회)"
                      className="p-2 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                    />
                    <textarea
                      value={newCommitteeNote}
                      onChange={(e) => setNewCommitteeNote(e.target.value)}
                      placeholder="구성 (심사처에서 전달받은 내용을 그대로 적어주세요)"
                      rows={2}
                      className="p-2 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCommittee}
                      disabled={pending || !newCommitteeName.trim()}
                      className="p-2 rounded-lg bg-zinc-900 text-white text-xs font-bold disabled:opacity-50 min-h-[36px]"
                    >
                      심의 주체 기록
                    </button>
                  </div>
                </details>
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="사유 (승인이 아니면 필수예요)"
                rows={3}
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none resize-none"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button onClick={() => handleDecide('approved')} disabled={pending}
                  className="flex-1 p-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 min-h-[44px]">
                  승인
                </button>
                <button onClick={() => handleDecide('conditional')} disabled={pending}
                  className="flex-1 p-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50 min-h-[44px]">
                  조건부 승인
                </button>
                <button onClick={() => handleDecide('rejected')} disabled={pending}
                  className="flex-1 p-3 rounded-xl bg-zinc-200 text-zinc-700 font-bold text-sm hover:bg-zinc-300 disabled:opacity-50 min-h-[44px]">
                  반려
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-400">아직 제출되지 않아 심의할 수 없어요.</p>
          )}
        </section>
      )}

      {latestReview && (
        <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-3">
          <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">통지</span>
          {notification ? (
            <p className="text-sm text-zinc-600">
              발송됨 {notification.is_read_by_participant ? '· 당사자 확인 완료' : '· 아직 확인 전'}
            </p>
          ) : (
            <button
              onClick={handleSendNotification}
              disabled={pending}
              className="p-3 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 disabled:opacity-50 min-h-[44px]"
            >
              통지 발송
            </button>
          )}
        </section>
      )}
    </div>
  )
}
