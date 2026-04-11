export default function ParticipantDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-zinc-200 rounded animate-pulse" />
          <div className="h-6 w-32 bg-zinc-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-6 w-14 bg-red-100 rounded-full animate-pulse" />
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 프로필 카드 skeleton */}
        <div className="p-6 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm animate-pulse">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-zinc-200" />
            <div>
              <div className="h-6 w-28 bg-zinc-200 rounded mb-2" />
              <div className="h-4 w-48 bg-zinc-100 rounded" />
            </div>
          </div>
          <div className="h-3 w-full bg-zinc-100 rounded-full mb-2" />
          <div className="flex justify-between">
            <div className="h-4 w-20 bg-zinc-100 rounded" />
            <div className="h-4 w-20 bg-zinc-100 rounded" />
          </div>
        </div>

        {/* 재원 카드 skeleton */}
        <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm animate-pulse">
          <div className="h-5 w-16 bg-zinc-200 rounded mb-4" />
          {[0, 1].map(i => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
              <div className="h-4 w-24 bg-zinc-200 rounded" />
              <div className="h-5 w-20 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>

        {/* 최근 거래 skeleton */}
        <div className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm animate-pulse">
          <div className="h-5 w-24 bg-zinc-200 rounded mb-4" />
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0 gap-4">
              <div className="flex-1">
                <div className="h-4 w-32 bg-zinc-200 rounded mb-1.5" />
                <div className="h-3 w-20 bg-zinc-100 rounded" />
              </div>
              <div className="h-5 w-16 bg-zinc-200 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
