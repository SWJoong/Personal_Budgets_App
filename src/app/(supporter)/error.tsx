'use client'

import { useEffect } from 'react'

export default function SupporterError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Supporter Error]', error)
  }, [error])

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 bg-background">
      <div className="text-center max-w-md">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="text-xl font-black text-foreground mb-2">페이지를 불러올 수 없습니다</h1>
        <p className="text-sm text-muted-foreground mb-6">
          데이터베이스 연결 또는 권한 문제가 발생했습니다.
          {error.digest && (
            <span className="block mt-1 text-xs font-mono text-muted-foreground">({error.digest})</span>
          )}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-hero text-hero-foreground font-bold rounded-xl hover:opacity-90 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </main>
  )
}
