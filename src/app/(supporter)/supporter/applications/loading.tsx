export default function ApplicationsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-muted rounded animate-pulse" />
          <div className="h-6 w-28 bg-muted rounded-lg animate-pulse" />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 검색/필터 바 skeleton */}
        <div className="h-14 rounded-2xl bg-muted animate-pulse" />

        {/* 목록 skeleton */}
        <section className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 rounded-2xl bg-card ring-1 ring-border shadow-sm animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1">
                  <div className="h-5 w-24 bg-muted rounded mb-2" />
                  <div className="h-4 w-full bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
