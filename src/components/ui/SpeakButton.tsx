'use client'

import { useState } from 'react'
import { speak, stopSpeaking } from '@/utils/tts'

/**
 * 읽어주기 버튼 — 주어진 text 를 느린 한국어(Web Speech API)로 읽어 준다. 발달장애인법 §10 의사소통지원.
 * 설계: docs/release/14 P1(TTS 주 플로우 확대). tts.ts speak/stopSpeaking 재사용.
 *
 * 토글: 재생 중 다시 누르면 정지. 자연 종료·오류 시 onEnd 로 상태 리셋. 미지원 브라우저에서도 안전(no-op).
 * 이모지는 aria-hidden, 접근성 이름은 label 로. 44px 터치영역.
 */
export default function SpeakButton({
  text,
  label = '음성으로 듣기',
  className = '',
}: {
  text: string
  label?: string
  className?: string
}) {
  const [speaking, setSpeaking] = useState(false)

  const toggle = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    speak(text, 0.85, () => setSpeaking(false))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={speaking ? `${label} 정지` : label}
      aria-pressed={speaking}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors ${className}`}
    >
      <span aria-hidden="true" className="text-xl">
        {speaking ? '⏹️' : '🔊'}
      </span>
    </button>
  )
}
