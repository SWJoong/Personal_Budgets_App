// 계획 채팅 스켈레톤
export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 animate-pulse">
      <div className="h-16 border-b border-zinc-100 flex items-center px-4">
        <div className="w-20 h-5 bg-zinc-100 rounded-full" />
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full flex flex-col gap-4 p-4">
        {/* AI 메시지 버블 */}
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-zinc-100 rounded-full shrink-0" />
          <div className="flex flex-col gap-2">
            <div className="w-48 h-12 bg-zinc-100 rounded-2xl rounded-tl-none" />
          </div>
        </div>

        {/* 칩 선택지들 */}
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-9 w-20 bg-zinc-100 rounded-full" />
          ))}
        </div>

        {/* 사용자 메시지 */}
        <div className="flex justify-end">
          <div className="w-36 h-10 bg-zinc-100 rounded-2xl rounded-tr-none" />
        </div>
      </div>

      {/* 입력창 */}
      <div className="sticky bottom-0 p-4 bg-background border-t border-zinc-100">
        <div className="h-12 bg-zinc-100 rounded-2xl" />
      </div>
    </div>
  )
}
