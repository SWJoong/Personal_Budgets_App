export default function ReviewQueueLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center gap-3 mb-8">
        <div className="h-7 w-7 bg-zinc-200 rounded animate-pulse" />
        <div>
          <div className="h-7 w-48 bg-zinc-200 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
        </div>
      </header>

      <main className="w-full max-w-2xl flex flex-col gap-4">
        {/* 헤더 액션 bar skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 bg-zinc-200 rounded animate-pulse" />
          <div className="h-9 w-32 bg-zinc-200 rounded-xl animate-pulse" />
        </div>

        {/* 카드 목록 skeleton */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl ring-1 ring-zinc-200 overflow-hidden shadow-sm animate-pulse">
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 bg-zinc-50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-zinc-200" />
                <div className="h-4 w-20 bg-zinc-200 rounded" />
              </div>
              <div className="h-5 w-16 bg-orange-100 rounded-full" />
            </div>
            {/* 카드 본문 */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="w-14 h-14 rounded-xl bg-zinc-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 w-36 bg-zinc-200 rounded mb-2" />
                <div className="h-3 w-48 bg-zinc-100 rounded" />
              </div>
              <div className="text-right shrink-0">
                <div className="h-5 w-20 bg-zinc-200 rounded mb-1.5" />
                <div className="h-3 w-12 bg-zinc-100 rounded" />
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <div className="h-7 w-12 bg-zinc-200 rounded-lg" />
                <div className="h-7 w-12 bg-zinc-100 rounded-lg" />
                <div className="h-7 w-12 bg-red-50 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
