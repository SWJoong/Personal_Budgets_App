'use client'

import { useState } from 'react'

interface Props {
  /** 피드백 질문 문구 */
  question?: string
  /** 완료 후 콜백 */
  onComplete?: (response: 'positive' | 'negative') => void
  /** 컴팩트 모드 (인라인 표시) */
  compact?: boolean
}

/**
 * SelfCheckFeedback — 자기결정 지원 피드백 모듈 (가이드라인 §5.2)
 *
 * 주요 프로세스 종료 시 당사자의 이해 여부와 선호도를 확인하는 디지털 점검표입니다.
 * 스마일/새드 페이스 아이콘을 통해 선호도를 데이터화합니다.
 */
export default function SelfCheckFeedback({
  question = '이 과정이 쉬웠나요?',
  onComplete,
  compact = false,
}: Props) {
  const [response, setResponse] = useState<'positive' | 'negative' | null>(null)

  function handleSelect(r: 'positive' | 'negative') {
    setResponse(r)
    onComplete?.(r)
  }

  if (response) {
    return (
      <div className={`flex items-center justify-center gap-3 ${compact ? 'py-3' : 'py-6'} animate-fade-in-up`}>
        <span className="text-3xl">{response === 'positive' ? '😊' : '😔'}</span>
        <p className="text-sm font-bold text-zinc-500">
          {response === 'positive' ? '좋아요! 의견을 고마워요.' : '알려줘서 고마워요. 더 쉽게 만들게요.'}
        </p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-4 ${compact ? 'py-4' : 'py-6'} animate-fade-in-up`}>
      <p className={`font-black text-zinc-700 text-center ${compact ? 'text-sm' : 'text-base'}`}>
        {question}
      </p>
      <div className="flex gap-8">
        <button
          onClick={() => handleSelect('positive')}
          className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
          aria-label="쉬웠어요"
        >
          <span className={compact ? 'text-4xl' : 'text-5xl'}>😊</span>
          <span className="text-sm font-bold text-zinc-600">쉬웠어요</span>
        </button>
        <button
          onClick={() => handleSelect('negative')}
          className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
          aria-label="어려웠어요"
        >
          <span className={compact ? 'text-4xl' : 'text-5xl'}>😔</span>
          <span className="text-sm font-bold text-zinc-600">어려웠어요</span>
        </button>
      </div>
    </div>
  )
}
