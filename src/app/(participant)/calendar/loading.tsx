// 달력 스켈레톤
export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 animate-pulse">
      <div className="h-16 border-b border-zinc-100 flex items-center justify-between px-4">
        <div className="w-20 h-5 bg-zinc-100 rounded-full" />
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-zinc-100 rounded-full" />
          <div className="w-8 h-8 bg-zinc-100 rounded-full" />
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full p-4 flex flex-col gap-4">
        {/* 월 네비게이션 */}
        <div className="flex justify-between items-center px-2">
          <div className="w-8 h-8 bg-zinc-100 rounded-full" />
          <div className="w-24 h-5 bg-zinc-100 rounded-full" />
          <div className="w-8 h-8 bg-zinc-100 rounded-full" />
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-5 bg-zinc-100 rounded-full" />
          ))}
        </div>

        {/* 달력 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square bg-zinc-50 rounded-xl" />
          ))}
        </div>

        {/* 이번 달 합계 카드 */}
        <div className="h-20 bg-white rounded-2xl ring-1 ring-zinc-100" />
      </div>
    </div>
  )
}
