// 당사자 홈 스켈레톤
export default function Loading() {
  return (
    <main id="main-content" tabIndex={-1} className="flex flex-col min-h-screen bg-background pb-20 animate-pulse">
      {/* 헤더 */}
      <div className="h-16 border-b border-border flex items-center justify-between px-4">
        <div className="w-28 h-5 bg-muted rounded-full" />
        <div className="w-16 h-7 bg-muted rounded-full" />
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full p-4 flex flex-col gap-5">
        {/* 잔액 위젯 스켈레톤 */}
        <div className="rounded-[2.5rem] bg-card ring-1 ring-border overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <div className="w-20 h-3 bg-muted rounded-full" />
              <div className="w-40 h-9 bg-muted rounded-xl" />
              <div className="w-28 h-3 bg-muted rounded-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-10 h-10 bg-muted rounded-xl" />
              ))}
            </div>
          </div>
          <div className="px-6 pb-4">
            <div className="h-3 w-full bg-muted rounded-full" />
          </div>
          <div className="h-40 bg-muted" />
          <div className="px-6 py-4 bg-muted border-t border-border flex gap-3">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 h-4 bg-muted rounded-full" />
          </div>
        </div>

        {/* 빠른 실행 스켈레톤 */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="h-28 bg-card rounded-2xl ring-1 ring-border" />
          ))}
        </div>

        {/* 최근 내역 스켈레톤 */}
        <div className="flex flex-col gap-3">
          <div className="w-16 h-3 bg-muted rounded-full" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-card rounded-xl ring-1 ring-border" />
          ))}
        </div>
      </div>
    </main>
  )
}
