export default function ReviewQueueLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 sm:p-8">
      <header className="flex items-center gap-3 mb-8">
        <div className="h-7 w-7 bg-muted rounded animate-pulse" />
        <div>
          <div className="h-7 w-48 bg-muted rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="w-full max-w-2xl flex flex-col gap-4">
        {/* 헤더 액션 bar skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-9 w-32 bg-muted rounded-xl animate-pulse" />
        </div>

        {/* 카드 목록 skeleton */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-card rounded-2xl ring-1 ring-border overflow-hidden shadow-sm animate-pulse">
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-muted" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
              <div className="h-5 w-16 bg-warning-bg rounded-full" />
            </div>
            {/* 카드 본문 */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="w-14 h-14 rounded-xl bg-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 w-36 bg-muted rounded mb-2" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
              <div className="text-right shrink-0">
                <div className="h-5 w-20 bg-muted rounded mb-1.5" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <div className="h-7 w-12 bg-muted rounded-lg" />
                <div className="h-7 w-12 bg-muted rounded-lg" />
                <div className="h-7 w-12 bg-danger-bg rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
