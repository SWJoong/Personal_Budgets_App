'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendPlanFeedback, type PlanFeedbackRow } from '@/app/actions/planFeedback'
import PlanFeedbackList from '@/components/plan/PlanFeedbackList'

/**
 * 당사자 계획 피드백 — "확인했어요"(acknowledged) 또는 "궁금해요"(question, 짧은 본문)를 남긴다.
 * 설계: docs/release/14 P2(④a). 계획은 열람 전용이라 이건 별도의 가벼운 한마디 채널이다.
 */
export default function ParticipantPlanFeedback({
  planId,
  feedback,
}: {
  planId: string | null
  feedback: PlanFeedbackRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [asking, setAsking] = useState(false)

  function send(kind: 'acknowledged' | 'question') {
    setError('')
    if (kind === 'question' && !message.trim()) {
      setError('궁금한 점을 적어 주세요.')
      return
    }
    startTransition(async () => {
      const r = await sendPlanFeedback(planId, kind, kind === 'question' ? message.trim() : undefined)
      if ('error' in r) {
        setError(r.error)
        return
      }
      setMessage('')
      setAsking(false)
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-3 p-5 rounded-3xl bg-card ring-1 ring-border">
      <h2 className="text-sm font-black text-foreground">선생님께 한마디</h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        계획을 보고 확인했다고 알리거나, 궁금한 점을 남길 수 있어요.
      </p>
      {error && <p className="text-xs text-danger-fg font-bold">{error}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => send('acknowledged')}
          disabled={pending}
          className="min-h-[44px] rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:bg-hero-hover transition-colors disabled:opacity-50"
        >
          👍 확인했어요
        </button>

        {asking ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="plan-feedback-message" className="sr-only">
              궁금한 점
            </label>
            <textarea
              id="plan-feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="궁금한 점을 적어요"
              className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm resize-y"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => send('question')}
                disabled={pending}
                className="flex-1 min-h-[44px] rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {pending ? '보내는 중...' : '보내기'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAsking(false)
                  setMessage('')
                }}
                disabled={pending}
                className="px-4 min-h-[44px] rounded-xl bg-muted text-muted-foreground font-bold text-sm hover:text-foreground transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="min-h-[44px] rounded-xl bg-muted text-foreground font-bold text-sm hover:bg-muted-hover transition-colors"
          >
            ❓ 궁금해요
          </button>
        )}
      </div>

      {feedback.length > 0 && (
        <div className="pt-1">
          <PlanFeedbackList feedback={feedback} />
        </div>
      )}
    </section>
  )
}
