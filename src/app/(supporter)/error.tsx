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
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 bg-zinc-50">
      <div className="text-center max-w-md">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-black text-zinc-900 mb-2">페이지를 불러올 수 없습니다</h2>
        <p className="text-sm text-zinc-500 mb-6">
          데이터베이스 연결 또는 권한 문제가 발생했습니다.
          {error.digest && (
            <span className="block mt-1 text-xs font-mono text-zinc-400">({error.digest})</span>
          )}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
