'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/ui/LiveRegion'
import { generateEasyReadSummary } from '@/app/actions/easyReadSummary'

/**
 * 쉬운 말 요약 — 담당자가 이 계획을 당사자가 읽기 쉬운 말로 요약해 함께 본다(설계 §3).
 * 액션: generateEasyReadSummary(planId). 접근성: 비동기(수 초) 진행·결과·오류를 라이브 영역(useToast)으로 알린다.
 * 투명성: AI 생성물이므로 내용 확인 후 사용하도록 안내한다.
 */
export default function EasyReadSummary({ planId }: { planId: string }) {
  const [pending, startTransition] = useTransition()
  const { announce } = useToast()
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')

  function handleGenerate() {
    setError('')
    announce('쉬운 말 요약을 만들고 있어요. 잠시만 기다려 주세요.', 'polite')
    startTransition(async () => {
      const result = await generateEasyReadSummary(planId)
      if ('error' in result) {
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      setSummary(result.summary)
      announce('쉬운 말 요약을 만들었어요.', 'polite')
    })
  }

  return (
    <section className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-3">
      <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">쉬운 말 요약</span>
      <p className="text-xs text-muted-foreground leading-relaxed">
        이 계획을 당사자가 읽기 쉬운 말로 요약해요. 당사자와 함께 볼 때 도움이 돼요.
      </p>

      <button
        onClick={handleGenerate}
        disabled={pending}
        className="p-3 rounded-xl bg-hero text-hero-foreground font-bold text-sm disabled:opacity-50 min-h-[44px]"
      >
        {pending ? '만들고 있어요…' : summary ? '다시 만들기' : '쉬운 말 요약 만들기'}
      </button>

      {error && (
        <p className="p-3 rounded-xl bg-danger-bg ring-1 ring-danger-fg/20 text-danger-fg text-sm font-medium leading-relaxed">
          {error}
        </p>
      )}

      {summary && !error && (
        <div className="p-4 rounded-xl bg-muted ring-1 ring-border">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        컴퓨터가 만든 요약이에요. 내용이 맞는지 꼭 확인하고 쓰세요.
      </p>
    </section>
  )
}
