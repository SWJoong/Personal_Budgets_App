'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createUtilizationPlan,
  upsertSelfNarrative,
  upsertRequestedService,
  deleteRequestedService,
  submitUtilizationPlan,
} from '@/app/actions/utilizationPlan'
import { markNotificationRead } from '@/app/actions/planReview'

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

const STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  submitted: '제출 완료 — 선생님들이 확인할 거예요',
  under_review: '선생님들이 확인하고 있어요',
  approved: '승인됐어요',
  conditional: '조건부로 승인됐어요',
  rejected: '반려됐어요',
  under_appeal: '다시 봐달라고 요청했어요',
}

const NARRATIVE_FIELDS: { key: keyof Narrative; label: string; placeholder: string }[] = [
  { key: 'strengths_talents', label: '나의 재능, 강점, 기술', placeholder: '내가 잘하는 것을 적어보세요' },
  { key: 'social_barriers', label: '장애로 인해 겪는 어려움', placeholder: '살면서 힘든 점을 적어보세요' },
  { key: 'desired_change', label: '내가 원하는 변화와 지원', placeholder: '어떤 도움이 필요한가요' },
  { key: 'desired_life', label: '내가 원하는 삶의 모습', placeholder: '어떻게 살고 싶은가요' },
  { key: 'goal_to_try', label: '시도하고 싶은 것', placeholder: '해보고 싶은 것을 적어보세요' },
]

export default function MyPlanClient({
  participantId,
  selectedApplicationId,
  plan,
  narrative,
  requestedServices,
  latestReview,
  notification,
}: {
  participantId: string
  selectedApplicationId: string | null
  plan: Plan | null
  narrative: Narrative | null
  requestedServices: RequestedService[]
  latestReview: Review | null
  notification: Notification | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [form, setForm] = useState<Narrative>({
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

  function handleStart() {
    if (!selectedApplicationId) return
    setError('')
    startTransition(async () => {
      const result = await createUtilizationPlan({
        participantId,
        applicationId: selectedApplicationId,
        authoredWithSupport: 'self',
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  /** 나의 상황 + 요청 서비스 저장. 실패하면 첫 에러 메시지를 돌려준다(성공이면 undefined). */
  async function saveNarrativeAndServices(): Promise<string | undefined> {
    if (!plan) return undefined

    const narrativeResult = await upsertSelfNarrative({ planId: plan.id, ...form })
    if (narrativeResult.error) return narrativeResult.error

    for (let i = 0; i < services.length; i++) {
      const s = services[i]
      if (!s.serviceName.trim()) {
        // 칸을 비우고 저장하면, 예전에 저장해둔 내용이 있다면 그것도 지운다 —
        // 안 그러면 화면은 비어 보이는데 실제로는 예전 내용이 그대로 남는다.
        if (s.id) {
          const result = await deleteRequestedService(s.id)
          if (result.error) return result.error
        }
        continue
      }
      const result = await upsertRequestedService({
        planId: plan.id,
        priority: i + 1,
        serviceName: s.serviceName.trim(),
        estimatedCost: s.estimatedCost ? Number(s.estimatedCost) : undefined,
      })
      if (result.error) return result.error
    }
    return undefined
  }

  function handleSave() {
    if (!plan) return
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
   * 제출 전에 반드시 먼저 저장한다. 그렇지 않으면 화면에 입력해 둔 내용이
   * 서버에는 없는 채로 상태만 submitted 로 바뀌고, 그 순간부터는 RLS가
   * draft 상태에서만 허용하던 나의 상황·요청 서비스 쓰기를 막아버려
   * 입력한 내용이 그대로 사라진다.
   */
  function handleSubmit() {
    if (!plan) return
    setError('')
    startTransition(async () => {
      const saveError = await saveNarrativeAndServices()
      if (saveError) {
        setError(saveError)
        return
      }
      const result = await submitUtilizationPlan(plan.id)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

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

  const isDraft = plan?.status === 'draft'
  const isDecided = plan && ['approved', 'conditional', 'rejected'].includes(plan.status)

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="홈으로 가기">
          ←
        </Link>
        <h1 className="text-sm font-black text-zinc-800">내 이용계획</h1>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-4 max-w-sm mx-auto w-full">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium leading-relaxed">
            {error}
          </div>
        )}

        {!plan ? (
          selectedApplicationId ? (
            <section className="p-8 rounded-3xl bg-zinc-900 text-white text-center flex flex-col gap-4">
              <span className="text-5xl">🎯</span>
              <p className="font-bold leading-relaxed">이용계획을 만들 수 있어요.<br />어떤 것에 예산을 쓰고 싶은지 적어볼까요?</p>
              <button
                onClick={handleStart}
                disabled={pending}
                className="p-3 rounded-xl bg-white text-zinc-900 font-bold text-sm disabled:opacity-50 min-h-[44px]"
              >
                계획 시작하기
              </button>
            </section>
          ) : (
            <section className="p-8 rounded-3xl bg-zinc-100 text-center">
              <p className="text-zinc-500 font-medium leading-relaxed">아직 선정되지 않았어요.<br />담당 선생님에게 말씀해 주세요.</p>
            </section>
          )
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
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-zinc-500">나의 상황</h2>
              {NARRATIVE_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-500 font-medium">{label}</label>
                  {isDraft ? (
                    <textarea
                      value={form[key] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      rows={2}
                      className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm leading-relaxed focus:ring-zinc-400 focus:outline-none resize-none"
                    />
                  ) : (
                    <p className="p-3 rounded-xl bg-white text-sm leading-relaxed">{form[key] || '—'}</p>
                  )}
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-zinc-500">쓰고 싶은 서비스</h2>
              {services.map((s, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-500 font-medium">{i + 1}순위</label>
                  {isDraft ? (
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <label className="text-[10px] text-zinc-400 font-medium">무엇에 쓰고 싶어요?</label>
                        <input
                          type="text"
                          value={s.serviceName}
                          onChange={(e) => {
                            const next = [...services]
                            next[i] = { ...next[i], serviceName: e.target.value }
                            setServices(next)
                          }}
                          placeholder="예: 웹툰 학원 수강"
                          className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                        />
                      </div>
                      <div className="w-28 flex flex-col gap-0.5">
                        <label className="text-[10px] text-zinc-400 font-medium">얼마쯤이에요? (원)</label>
                        <input
                          type="number"
                          value={s.estimatedCost}
                          onChange={(e) => {
                            const next = [...services]
                            next[i] = { ...next[i], estimatedCost: e.target.value }
                            setServices(next)
                          }}
                          placeholder="0"
                          className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    s.serviceName && <p className="p-3 rounded-xl bg-white text-sm">{s.serviceName}</p>
                  )}
                </div>
              ))}
            </section>

            {isDraft && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSave}
                  disabled={pending}
                  className="p-3 rounded-xl bg-white ring-1 ring-zinc-300 text-zinc-700 font-bold text-sm disabled:opacity-50 min-h-[44px]"
                >
                  저장하기
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={pending}
                  className="p-3 rounded-xl bg-zinc-900 text-white font-bold text-sm disabled:opacity-50 min-h-[44px]"
                >
                  제출하기
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
