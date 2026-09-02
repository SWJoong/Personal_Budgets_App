'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/ui/LiveRegion'
import { generateActivitySuggestions } from '@/app/actions/activitySuggestion'
import type { ActivitySuggestion } from '@/utils/activitySuggestion'

/**
 * AI 활동 제안 — 당사자가 '남은 돈'으로 해볼 만한 활동을 추천받는다(설계 §4). 액션: generateActivitySuggestions().
 * 접근성: 생성은 비동기(수 초)라 진행·결과·오류를 라이브 영역(useToast)으로 알린다.
 * 투명성: 결과가 AI 생성 참고임을 명시한다(발달장애 당사자 대상).
 */
export default function ActivitySuggestions() {
  const [pending, startTransition] = useTransition()
  const { announce } = useToast()
  const [done, setDone] = useState(false)
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([])
  const [error, setError] = useState('')

  function handleGet() {
    setError('')
    announce('해볼 만한 활동을 찾고 있어요. 잠시만 기다려 주세요.', 'polite')
    startTransition(async () => {
      const result = await generateActivitySuggestions()
      if ('error' in result) {
        setError(result.error)
        setDone(true)
        announce(result.error, 'assertive')
        return
      }
      setSuggestions(result.suggestions)
      setDone(true)
      announce(
        result.suggestions.length > 0
          ? `해볼 만한 활동 ${result.suggestions.length}개를 찾았어요.`
          : '지금은 추천할 활동을 찾지 못했어요.',
        'polite',
      )
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-bold text-zinc-500">이런 활동 어때요?</h2>
        <p className="text-xs text-zinc-600 mt-0.5">남은 돈으로 해볼 만한 활동을 찾아 줘요.</p>
      </div>

      <button
        onClick={handleGet}
        disabled={pending}
        className="px-6 py-3 min-h-[44px] rounded-xl bg-zinc-900 text-white font-bold disabled:opacity-60"
      >
        {pending ? '찾고 있어요…' : !done ? '활동 추천받기' : '다시 추천받기'}
      </button>

      {error && (
        <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-200 text-red-700 text-sm font-medium leading-relaxed">
          {error}
        </p>
      )}

      {done && !error && (
        suggestions.length === 0 ? (
          <p className="text-sm text-zinc-600 leading-relaxed">
            지금은 추천할 활동을 찾지 못했어요. 나중에 다시 해 봐요.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {suggestions.map((s, i) => (
              <li
                key={`${s.domainId}-${i}`}
                className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-1"
              >
                <span className="font-bold leading-relaxed">{s.title}</span>
                <span className="text-sm text-zinc-600 leading-relaxed">{s.why}</span>
                {typeof s.estCost === 'number' && (
                  <span className="text-xs text-zinc-500">약 {Math.round(s.estCost).toLocaleString('ko-KR')}원</span>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      <p className="text-xs text-zinc-500 leading-relaxed px-1">
        추천은 컴퓨터가 만든 참고예요. 하고 싶은 게 있으면 선생님에게 말해 주세요.
      </p>
    </section>
  )
}
