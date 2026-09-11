'use client'

import { useState, useTransition } from 'react'
import { generateStaffReviewSuggestions } from '@/app/actions/staffReviewSuggestion'
import type { ReviewSuggestion } from '@/utils/staffReviewSuggestion'

/**
 * 실무자용 AI 점검 제안 — 온디맨드 화면. 계약: StaffReviewSuggestions.test.tsx.
 * 설계: Plan&Source/goala_staff_review_assistant_W.md §4.
 *
 * 버튼을 눌러야만 액션을 호출한다(비용 제어). 상태(로딩/제안/빈/에러)는 aria-live 영역으로 알린다.
 * 과신 방지: 제안 하단에 '최종 판단은 선생님이' 안전 고지. priority 배지 = high(danger)·medium(warning)·low(neutral).
 */

type Result = { suggestions: ReviewSuggestion[] } | { error: string } | null

const PRIORITY: Record<ReviewSuggestion['priority'], { label: string; cls: string }> = {
  high: { label: '높음', cls: 'bg-danger-bg text-danger-fg' },
  medium: { label: '보통', cls: 'bg-warning-bg text-warning-fg' },
  low: { label: '낮음', cls: 'bg-muted text-muted-foreground' },
}

export default function StaffReviewSuggestions({ participantId }: { participantId: string }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<Result>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await generateStaffReviewSuggestions(participantId)
      setResult(res)
    })
  }

  const suggestions = result && 'suggestions' in result ? result.suggestions : null
  const error = result && 'error' in result ? result.error : null

  return (
    <section className="flex flex-col gap-4">
      <div className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-3">
        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">AI 점검 제안</span>
        <p className="text-sm text-muted-foreground leading-relaxed">
          이 당사자의 예산·점검·계획을 살펴보고, 먼저 챙길 일을 우선순위로 알려드려요.
        </p>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="p-3 rounded-xl bg-hero text-hero-foreground font-bold text-sm disabled:opacity-50 min-h-[44px]"
        >
          {pending ? '살펴보고 있어요…' : '🤖 AI 점검 제안 보기'}
        </button>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {pending && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            점검할 내용을 살펴보고 있어요. 잠시만 기다려 주세요.
          </p>
        )}

        {error && (
          <p className="p-4 rounded-xl bg-danger-bg ring-1 ring-danger-fg/20 text-danger-fg text-sm font-medium leading-relaxed">
            {error}
          </p>
        )}

        {suggestions && suggestions.length === 0 && (
          <p className="p-4 rounded-xl bg-card ring-1 ring-border text-sm text-muted-foreground leading-relaxed">
            지금 점검할 항목이 없어요. 예산·점검·계획이 모두 정상이에요.
          </p>
        )}

        {suggestions && suggestions.length > 0 && (
          <>
            <ul className="flex flex-col gap-3">
              {suggestions.map((s, i) => {
                const p = PRIORITY[s.priority]
                return (
                  <li
                    key={`${s.basis}-${i}`}
                    className="p-4 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.cls}`}>{p.label}</span>
                      <span className="text-sm font-bold text-foreground">{s.headline}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.action}</p>
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI가 만든 참고 제안이에요. 최종 판단은 선생님이 해요.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
