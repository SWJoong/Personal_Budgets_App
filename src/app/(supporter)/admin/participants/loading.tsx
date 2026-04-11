export default function ParticipantsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-zinc-200 rounded animate-pulse" />
          <div className="h-6 w-28 bg-zinc-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-6 w-14 bg-red-100 rounded-full animate-pulse" />
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 요약 카드 skeleton */}
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
              <div className="h-3 w-20 bg-zinc-200 rounded animate-pulse mb-3" />
              <div className="h-9 w-16 bg-zinc-200 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>

        {/* 등록 버튼 skeleton */}
        <div className="h-14 rounded-2xl bg-zinc-200 animate-pulse" />

        {/* 목록 skeleton */}
        <section className="flex flex-col gap-3">
          <div className="h-3 w-20 bg-zinc-200 rounded animate-pulse ml-1" />
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-200 shrink-0" />
                <div className="flex-1">
                  <div className="h-5 w-24 bg-zinc-200 rounded mb-2" />
                  <div className="h-4 w-full bg-zinc-100 rounded" />
                </div>
                <div className="h-4 w-4 bg-zinc-200 rounded" />
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
