'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reviewRequestedService } from '@/app/actions/utilizationPlan'
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

      <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-3">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">나의 상황</span>
        {narrative ? (
          NARRATIVE_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-xs text-zinc-400 font-medium">{label}</span>
              <p className="text-sm text-zinc-700 leading-relaxed">{narrative[key] || '—'}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-400">아직 작성되지 않았어요.</p>
        )}
      </section>

      <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-3">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">요청 서비스</span>
        {requestedServices.length === 0 ? (
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
