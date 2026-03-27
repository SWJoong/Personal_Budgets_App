'use client'

const getSeason = (month: number) => {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

const SEASON_LABELS: Record<string, string> = {
  spring: '\uc73c\ub974\uace0 \uc788\ub294 \uc911',
  summer: '\ud558\ub8f9\uc774 \ub367 \ub098\ub294 \uc911',
  autumn: '\ub2e8\ud48d\uc774 \ub4e4\ub294 \uc911',
  winter: '\uc801\uc124\uc774 \ub0b4\ub9ac\ub294 \uc911',
}

const SEASON_EMOJIS: Record<string, string> = {
  spring: '\ud83c\udf38',
  summer: '\ud83c\udf33',
  autumn: '\ud83c\udf41',
  winter: '\u2744\ufe0f',
}

export function SeasonTreeVisual() {
  const now = new Date()
  const month = now.getMonth() + 1
  const season = getSeason(month)
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  )
  const progress = Math.round((dayOfYear / 365) * 100)

  return (
    <div className="mt-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">
          {SEASON_EMOJIS[season]} 올해 흐름
        </span>
      </div>
      <div className="flex items-end gap-1 h-12">
        {['winter', 'spring', 'summer', 'autumn', 'winter'].map((s, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-full flex items-end justify-center text-lg ${
              s === season ? 'opacity-100 scale-110' : 'opacity-30'
            } transition-all duration-300`}
            style={{ height: s === season ? '100%' : '60%' }}
          >
            <span>{SEASON_EMOJIS[s]}</span>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-200 via-green-300 to-orange-300"
            style={{ width: `${progress}%`, transition: 'width 0.5s' }}
          />
        </div>
      </div>
    </div>
  )
}
