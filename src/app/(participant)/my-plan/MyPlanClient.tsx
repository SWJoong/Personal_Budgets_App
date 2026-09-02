'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { markNotificationRead } from '@/app/actions/planReview'
import { fileAppeal } from '@/app/actions/appeal'
import ActivitySuggestions from './ActivitySuggestions'

interface Plan {
  id: string
  application_id: string
  cohort_id: string
  status: string
}

interface Narrative {
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
}

interface Review {
  id: string
  decision: string
  reason: string | null
}

interface Notification {
  id: string
  is_read_by_participant: boolean
}

interface Appeal {
  id: string
  outcome: string
  outcome_reason: string | null
}

const APPEAL_OUTCOME_LABEL: Record<string, string> = {
  pending: '아직 확인하고 있어요',
  upheld: '다시 확인해서 바꿨어요',
  partially_upheld: '다시 확인해서 일부 바꿨어요',
  dismissed: '다시 확인했지만 그대로예요',
}

const STATUS_LABEL: Record<string, string> = {
  draft: '선생님이 계획을 만들고 있어요',
  submitted: '제출 완료 — 선생님들이 확인할 거예요',
  under_review: '선생님들이 확인하고 있어요',
  approved: '승인됐어요',
  conditional: '조건부로 승인됐어요',
  rejected: '반려됐어요',
  under_appeal: '다시 봐달라고 요청했어요',
}

const NARRATIVE_FIELDS: { key: keyof Narrative; label: string }[] = [
  { key: 'strengths_talents', label: '나의 재능, 강점, 기술' },
  { key: 'social_barriers', label: '장애로 인해 겪는 어려움' },
  { key: 'desired_change', label: '내가 원하는 변화와 지원' },
  { key: 'desired_life', label: '내가 원하는 삶의 모습' },
  { key: 'goal_to_try', label: '시도하고 싶은 것' },
]

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

/**
 * 당사자의 이용계획 화면 — 열람 전용.
 *
 * 기관 확인(2026-07-31): 계획 신청서는 수행기관 담당자(사회복지사)가 작성하고,
 * 당사자는 제출 전 내용을 검토(열람)만 한다. 그래서 이 화면에는 작성·저장·제출
 * 버튼이 없다. 대신 담당자가 적은 내용을 그대로 보여주고, 결과 통지 확인과
 * 이의신청(당사자 권리)만 당사자가 직접 조작한다.
 */
export default function MyPlanClient({
  participantId,
  plan,
  narrative,
  requestedServices,
  latestReview,
  notification,
  appeal,
}: {
  participantId: string
  plan: Plan | null
  narrative: Narrative | null
  requestedServices: RequestedService[]
  latestReview: Review | null
  notification: Notification | null
  appeal: Appeal | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [appealGround, setAppealGround] = useState('')
  const [showAppealForm, setShowAppealForm] = useState(false)

  const narrativeValue = (key: keyof Narrative) => narrative?.[key] ?? ''
  const filledServices = [1, 2, 3]
    .map((priority) => requestedServices.find((s) => s.priority === priority))
    .filter((s): s is RequestedService => !!s && !!s.service_name)

  function handleConfirmNotification() {
    if (!notification) return
    setError('')
    startTransition(async () => {
      const result = await markNotificationRead(notification.id)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  /**
   * 이의신청 — 당사자 본인이 직접 낼 수 있어야 한다는 원칙(RLS 로 이미 보장됨).
   * 톤 원칙: "이의신청"이라는 법률 용어 대신 "다시 봐달라고 요청하기"로 풀어
   * 쓴다. 불이익 걱정 없이 편하게 요청할 수 있다는 안내 문구를 함께 둔다.
   */
  function handleFileAppeal() {
    if (!notification || !appealGround.trim()) {
      setError('어떤 점을 다시 봐달라는 건지 적어주세요.')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await fileAppeal({
        notificationId: notification.id,
        participantId,
        ground: appealGround.trim(),
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setAppealGround('')
      setShowAppealForm(false)
      router.refresh()
    })
  }

  const isDecided = plan && ['approved', 'conditional', 'rejected'].includes(plan.status)

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="홈으로 가기">
          ←
        </Link>
        <h1 className="text-sm font-black text-zinc-800">내 이용계획</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col gap-4 max-w-sm mx-auto w-full">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium leading-relaxed">
            {error}
          </div>
        )}

        {!plan ? (
          <section className="p-8 rounded-3xl bg-zinc-100 text-center">
            <p className="text-zinc-500 font-medium leading-relaxed">
              아직 계획이 없어요.<br />담당 선생님이 함께 계획을 만들 거예요.
            </p>
          </section>
        ) : (
          <>
            <section className="p-5 rounded-2xl bg-zinc-100">
              <p className="font-bold text-sm leading-relaxed">{STATUS_LABEL[plan.status] ?? plan.status}</p>
            </section>

            {isDecided && latestReview && (
              <section className={`p-6 rounded-3xl text-center ${latestReview.decision === 'approved' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                <p className="font-bold leading-relaxed">{STATUS_LABEL[latestReview.decision]}</p>
                {latestReview.reason && <p className="text-sm text-zinc-500 leading-relaxed mt-2">{latestReview.reason}</p>}
                {notification && !notification.is_read_by_participant && (
                  <button
                    onClick={handleConfirmNotification}
                    disabled={pending}
                    className="mt-4 px-6 py-3 min-h-[44px] rounded-xl bg-zinc-900 text-white font-bold disabled:opacity-50"
                  >
                    확인했어요
                  </button>
                )}

                {latestReview.decision !== 'approved' && notification && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-col gap-3">
                    {appeal ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-zinc-700">다시 봐달라고 요청했어요</span>
                        <span className="text-xs text-zinc-500 leading-relaxed">{APPEAL_OUTCOME_LABEL[appeal.outcome] ?? appeal.outcome}</span>
                        {appeal.outcome_reason && (
                          <p className="text-xs text-zinc-500 leading-relaxed mt-1">{appeal.outcome_reason}</p>
                        )}
                      </div>
                    ) : showAppealForm ? (
                      <>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          결과가 이상하다고 느끼면 편하게 다시 봐달라고 요청할 수 있어요.
                          요청한다고 불이익이 생기지 않아요.
                        </p>
                        <textarea
                          value={appealGround}
                          onChange={(e) => setAppealGround(e.target.value)}
                          placeholder="어떤 점을 다시 봐주면 좋을지 적어주세요"
                          rows={3}
                          className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm leading-relaxed focus:ring-zinc-400 focus:outline-none resize-none"
                        />
                        <button
                          onClick={handleFileAppeal}
                          disabled={pending}
                          className="px-6 py-3 min-h-[44px] rounded-xl bg-zinc-900 text-white font-bold disabled:opacity-50"
                        >
                          요청 보내기
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowAppealForm(true)}
                        className="px-6 py-3 min-h-[44px] rounded-xl bg-white ring-1 ring-zinc-300 text-zinc-700 font-bold"
                      >
                        다시 봐달라고 요청하기
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* 담당 선생님이 적은 내용을 그대로 보여준다 — 당사자는 검토(열람)만 한다.
                내용을 바꾸고 싶으면 담당 선생님에게 말하도록 안내한다. */}
            <p className="text-xs text-zinc-400 leading-relaxed px-1">
              담당 선생님이 함께 적은 내용이에요. 다르게 하고 싶은 게 있으면 선생님에게 말해 주세요.
            </p>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-zinc-500">나의 상황</h2>
              {NARRATIVE_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-500 font-medium">{label}</label>
                  <p className="p-3 rounded-xl bg-white text-sm leading-relaxed whitespace-pre-wrap">{narrativeValue(key) || '—'}</p>
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-zinc-500">쓰고 싶은 서비스</h2>
              {filledServices.length === 0 ? (
                <p className="text-sm text-zinc-400 leading-relaxed">아직 정해진 서비스가 없어요.</p>
              ) : (
                filledServices.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white">
                    <span className="text-sm">
                      <span className="text-zinc-400 mr-2">{s.priority}순위</span>
                      {s.service_name}
                    </span>
                    {s.estimated_cost != null && (
                      <span className="text-sm text-zinc-500 shrink-0">{won(Number(s.estimated_cost))}</span>
                    )}
                  </div>
                ))
              )}
            </section>

            <ActivitySuggestions />
          </>
        )}
      </main>
    </div>
  )
}
