export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // 모바일: full-width / 태블릿·데스크탑: 중앙 정렬 "앱 프레임"
    <div className="min-h-dvh bg-zinc-200/60 sm:flex sm:justify-center sm:items-start">
      <div className="w-full sm:max-w-[500px] min-h-dvh bg-background flex flex-col sm:shadow-[0_0_60px_-12px_rgba(0,0,0,0.18)]">
        {children}
      </div>
    </div>
  )
}
