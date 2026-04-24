interface SupportGoalEasyCardProps {
  id: string
  orderIndex: number
  supportArea: string
  easyDescription: string | null
  easyImageUrl: string | null    // signed URL (서버에서 미리 생성)
}

const FALLBACK_STYLES: { emoji: string; bg: string }[] = [
  { emoji: '⭐', bg: 'bg-yellow-100' },
  { emoji: '🌱', bg: 'bg-green-100' },
  { emoji: '💪', bg: 'bg-orange-100' },
  { emoji: '🎈', bg: 'bg-pink-100' },
  { emoji: '🌈', bg: 'bg-violet-100' },
  { emoji: '🔥', bg: 'bg-red-100' },
  { emoji: '🦋', bg: 'bg-blue-100' },
  { emoji: '🍀', bg: 'bg-teal-100' },
  { emoji: '🏆', bg: 'bg-amber-100' },
  { emoji: '🎯', bg: 'bg-indigo-100' },
]

export default function SupportGoalEasyCard({
  orderIndex,
  supportArea,
  easyDescription,
  easyImageUrl,
}: SupportGoalEasyCardProps) {
  const fallback = FALLBACK_STYLES[(orderIndex - 1) % FALLBACK_STYLES.length]
  const displayText = easyDescription || supportArea

  return (
    <div className="flex-shrink-0 snap-start w-[120px] h-[120px] rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden bg-white flex flex-col">
      {/* 이미지 영역 (상단 56px) */}
      {easyImageUrl ? (
        <img
          src={easyImageUrl}
          alt={displayText}
          className="w-full h-14 object-cover"
          width={120}
          height={56}
        />
      ) : (
        <div
          className={`w-full h-14 flex items-center justify-center text-3xl ${fallback.bg}`}
          aria-label={displayText}
        >
          <span role="img" aria-hidden="true">{fallback.emoji}</span>
        </div>
      )}

      {/* 텍스트 영역 (하단) */}
      <div className="flex-1 flex items-center justify-center p-1.5">
        <p className="text-xs font-black text-zinc-900 text-center leading-tight line-clamp-2">
          {displayText}
        </p>
      </div>
    </div>
  )
}
