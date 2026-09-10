export default function SettlementsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-muted rounded animate-pulse" />
          <div className="h-6 w-24 bg-muted rounded-lg animate-pulse" />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* 전체 요약 skeleton */}
        <div className="h-20 rounded-2xl bg-muted animate-pulse" />

        {/* 참여자별 그룹 skeleton */}
        <section className="flex flex-col gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="p-4 rounded-2xl bg-card ring-1 ring-border shadow-sm animate-pulse">
              <div className="h-5 w-24 bg-muted rounded mb-3" />
              <div className="h-4 w-full bg-muted rounded" />
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
