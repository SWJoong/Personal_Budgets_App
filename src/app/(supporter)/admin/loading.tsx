export default function AdminDashboardLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="h-6 w-40 bg-zinc-200 rounded-lg animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 bg-zinc-200 rounded animate-pulse" />
          <div className="h-6 w-14 bg-red-100 rounded-full animate-pulse" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 안내 배너 skeleton */}
        <div className="h-12 rounded-xl bg-blue-50 border border-blue-100 animate-pulse" />

        {/* 환영 섹션 skeleton */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/20 animate-pulse" />
            <div className="h-7 w-48 bg-white/20 rounded-lg animate-pulse" />
          </div>
          <div className="h-4 w-64 bg-white/10 rounded animate-pulse" />
        </div>

        {/* 알림 패널 skeleton */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-orange-200 bg-orange-100">
            <div className="h-4 w-40 bg-orange-200 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-orange-100">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 animate-pulse" />
                <div className="h-4 w-16 bg-orange-100 rounded animate-pulse" />
                <div className="h-4 w-48 bg-orange-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* 통계 카드 skeleton */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
              <div className="h-3 w-24 bg-zinc-200 rounded animate-pulse mb-3" />
              <div className="h-9 w-20 bg-zinc-200 rounded-lg animate-pulse" />
            </div>
          ))}
        </section>

        {/* 미리보기 섹션 skeleton */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-40 bg-zinc-200 rounded-lg animate-pulse mb-2" />
              <div className="h-4 w-56 bg-zinc-100 rounded animate-pulse" />
            </div>
            <div className="h-4 w-16 bg-zinc-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-5 w-20 bg-zinc-200 rounded" />
                  <div className="h-5 w-16 bg-zinc-100 rounded-full" />
                </div>
                <div className="h-2.5 w-full bg-zinc-100 rounded-full mb-3" />
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-zinc-100 rounded" />
                  <div className="h-4 w-20 bg-zinc-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 빠른 실행 skeleton */}
        <section className="flex flex-col gap-3">
          <div className="h-3 w-16 bg-zinc-200 rounded animate-pulse ml-1" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white ring-1 ring-zinc-200 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-zinc-200 mb-3" />
                <div className="h-5 w-20 bg-zinc-200 rounded" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
