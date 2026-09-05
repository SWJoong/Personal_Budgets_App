export default function ParticipantDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-muted rounded animate-pulse" />
          <div className="h-6 w-32 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="h-6 w-14 bg-danger-bg rounded-full animate-pulse" />
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 프로필 카드 skeleton */}
        <div className="p-6 rounded-2xl bg-card ring-1 ring-border shadow-sm animate-pulse">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-muted" />
            <div>
              <div className="h-6 w-28 bg-muted rounded mb-2" />
              <div className="h-4 w-48 bg-muted rounded" />
            </div>
          </div>
          <div className="h-3 w-full bg-muted rounded-full mb-2" />
          <div className="flex justify-between">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        </div>

        {/* 재원 카드 skeleton */}
        <div className="p-5 rounded-2xl bg-card ring-1 ring-border shadow-sm animate-pulse">
          <div className="h-5 w-16 bg-muted rounded mb-4" />
          {[0, 1].map(i => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-5 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>

        {/* 최근 거래 skeleton */}
        <div className="p-5 rounded-2xl bg-card ring-1 ring-border shadow-sm animate-pulse">
          <div className="h-5 w-24 bg-muted rounded mb-4" />
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-4">
              <div className="flex-1">
                <div className="h-4 w-32 bg-muted rounded mb-1.5" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
              <div className="h-5 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
