'use client'

import { useEffect } from 'react'

/**
 * 당사자 라우트그룹 에러 바운더리 (P7 웨이브3 A4). (supporter)/error.tsx 를 당사자 easy-read 톤으로 이식.
 * 계약: src/app/(participant)/error.p7c.test.tsx — main#main-content · 유일 h1 · 복구 버튼.
 */
export default function ParticipantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Participant Error]', error)
  }, [error])

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 bg-background text-foreground">
      <div className="text-center max-w-sm flex flex-col items-center gap-3">
        <span className="text-6xl" aria-hidden="true">🙂</span>
        <h1 className="text-xl font-black text-foreground leading-relaxed">화면을 열 수 없어요</h1>
        <p className="text-muted-foreground font-medium leading-relaxed">
          잠깐 문제가 생겼어요. 아래를 눌러 다시 해 볼까요?
          {error.digest && (
            <span className="block mt-1 text-xs font-mono text-muted-foreground">({error.digest})</span>
          )}
        </p>
        <button
          onClick={reset}
          className="mt-2 px-6 py-3 min-h-[44px] bg-hero text-hero-foreground font-bold rounded-xl hover:opacity-90 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </main>
  )
}
