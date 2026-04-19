'use client'

export interface WeeklyDay {
  date: string
  dayOfWeek: string
  photoUrl?: string | null
  amount?: number
}

export interface WeeklyPhotoGridProps {
  weeklyData: WeeklyDay[]
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export default function WeeklyPhotoGrid({ weeklyData }: WeeklyPhotoGridProps) {
  // Ensure we have exactly 7 days
  const displayData = weeklyData.length >= 7 ? weeklyData.slice(0, 7) : weeklyData

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-700">주간 지출 현황</h3>

      {/* 1x7 Grid */}
      <div className="grid grid-cols-7 gap-2">
        {displayData.map((day, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1">
            {/* Day Label */}
            <span className="text-xs text-zinc-500 font-medium h-4">
              {DAY_LABELS[idx] || `${idx}`}
            </span>

            {/* Photo Thumbnail */}
            <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden hover:shadow-md transition-shadow">
              {day.photoUrl ? (
                <img
                  src={day.photoUrl}
                  alt={`${day.dayOfWeek} 지출`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-xs text-gray-400 text-center px-1">없음</span>
              )}
            </div>

            {/* Amount (Optional) */}
            {day.amount && day.amount > 0 && (
              <span className="text-[10px] text-zinc-600 font-semibold">
                {(day.amount / 1000).toFixed(0)}K
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Empty Days Notice */}
      {displayData.some(d => !d.photoUrl) && (
        <p className="text-xs text-zinc-400 text-center">
          ℹ️ 영수증이 없는 날짜는 빈 상태로 표시됩니다.
        </p>
      )}
    </div>
  )
}
