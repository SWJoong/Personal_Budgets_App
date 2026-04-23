import FaqButton from '@/components/ui/FaqButton'

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // 모바일: full-width / 태블릿·데스크탑: 중앙 정렬 "앱 프레임"
    <div className="min-h-dvh bg-zinc-200/60 lg:flex lg:justify-center lg:items-start">
      <div className="participant-view w-full lg:max-w-[600px] min-h-dvh bg-background flex flex-col lg:shadow-[0_0_60px_-12px_rgba(0,0,0,0.18)]">
        {children}
      </div>
    </div>
  )
}
