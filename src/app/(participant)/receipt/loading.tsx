// 영수증 업로드 스켈레톤
export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 animate-pulse">
      <div className="h-16 border-b border-border flex items-center px-4 gap-3">
        <div className="w-8 h-8 bg-muted rounded-full" />
        <div className="w-24 h-5 bg-muted rounded-full" />
      </div>

      <div className="max-w-lg mx-auto w-full p-4 flex flex-col gap-4">
        {/* 사진 업로드 영역 */}
        <div className="aspect-[3/2] bg-muted rounded-3xl" />

        {/* 입력 필드들 */}
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-14 bg-muted rounded-2xl" />
        ))}

        {/* 버튼 */}
        <div className="h-14 bg-muted rounded-2xl mt-2" />
      </div>
    </div>
  )
}
