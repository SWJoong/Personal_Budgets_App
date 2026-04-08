'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/utils/budget-visuals'

type WidgetStyle = 'pouch' | 'water' | 'emoji'

const EMOJI_CHOICES = [
  { emoji: '🍎', name: '사과' },
  { emoji: '🍪', name: '쿠키' },
  { emoji: '⭐', name: '별' },
  { emoji: '🐥', name: '병아리' },
  { emoji: '🌸', name: '꽃' },
  { emoji: '🎈', name: '풍선' },
  { emoji: '🍋', name: '레몬' },
  { emoji: '🍩', name: '도넛' },
  { emoji: '🦊', name: '여우' },
  { emoji: '🎀', name: '리본' },
  { emoji: '🍇', name: '포도' },
  { emoji: '🐻', name: '곰' },
]

const THEME = {
  green:  { fill: '#22c55e', stroke: '#16a34a', light: '#dcfce7', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' },
  blue:   { fill: '#3b82f6', stroke: '#2563eb', light: '#dbeafe', text: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-100' },
  indigo: { fill: '#6366f1', stroke: '#4f46e5', light: '#e0e7ff', text: 'text-indigo-700', bg: 'bg-zinc-50', border: 'border-zinc-100' },
  orange: { fill: '#f97316', stroke: '#ea580c', light: '#ffedd5', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100' },
  red:    { fill: '#ef4444', stroke: '#dc2626', light: '#fee2e2', text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-100' },
  zinc:   { fill: '#71717a', stroke: '#52525b', light: '#f4f4f5', text: 'text-zinc-700',  bg: 'bg-zinc-50',  border: 'border-zinc-100' },
} as const

type ThemeKey = keyof typeof THEME

interface DailyTransaction {
  date: string
  amount: number
  activity_name: string
  status: 'pending' | 'confirmed'
  receipt_image_url?: string | null
}

interface Props {
  currentBalance: number
  totalBudget: number
  percentage: number
  themeColor: string
  icon: string
  statusMessage: string
  remainingDays: number
  dailyTransactions?: DailyTransaction[]
}

// ── 돈주머니 SVG ──────────────────────────────────────────────
function PouchViz({ percentage, themeColor, icon }: { percentage: number; themeColor: string; icon: string }) {
  const c = THEME[(themeColor as ThemeKey)] ?? THEME.zinc
  const fill = Math.max(2, percentage)

  return (
    <div className="flex items-center justify-center py-6">
      <div className="relative" style={{ width: 130, height: 130 }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <ellipse cx="50" cy="60" rx="38" ry="35" fill={c.light} stroke={c.stroke} strokeWidth="2.5" />
          <clipPath id="pw-clip">
            <ellipse cx="50" cy="60" rx="36" ry="33" />
          </clipPath>
          <rect
            x="12"
            y={95 - fill * 0.7}
            width="76"
            height={fill * 0.7 + 5}
            fill={c.fill}
            opacity="0.45"
            clipPath="url(#pw-clip)"
            style={{ transition: 'all 1s ease' }}
          />
          <path
            d="M 25 32 Q 35 10 50 15 Q 65 10 75 32"
            fill="none"
            stroke={c.stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="50" cy="15" r="4" fill={c.fill} />
          <text x="50" y="68" textAnchor="middle" fontSize="26" className="select-none">
            {icon}
          </text>
        </svg>
        <div
          className="absolute -bottom-1 -right-1 w-11 h-11 rounded-full flex items-center justify-center text-xs font-black text-white shadow-md"
          style={{ background: c.fill }}
        >
          {percentage}%
        </div>
      </div>
    </div>
  )
}

// ── 물컵 ─────────────────────────────────────────────────────
function WaterViz({ percentage }: { percentage: number }) {
  const isLow = percentage < 25

  return (
    <div className="flex items-center justify-center py-6">
      <div className="relative w-28 h-40">
        <div className="absolute inset-0 border-[5px] border-blue-300 rounded-b-[2rem] rounded-t-xl bg-white overflow-hidden">
          <div
            className={`absolute bottom-0 w-full transition-all duration-1000 ease-in-out ${isLow ? 'bg-red-400' : 'bg-blue-400'} opacity-70`}
            style={{ height: `${percentage}%` }}
          />
          {/* 물결 효과 */}
          {percentage > 5 && (
            <div
              className={`absolute w-[200%] h-4 -left-1/2 ${isLow ? 'bg-red-400' : 'bg-blue-400'} opacity-30 rounded-full`}
              style={{
                bottom: `calc(${percentage}% - 8px)`,
                animation: 'wave 2s linear infinite',
              }}
            />
          )}
        </div>
        {/* 컵 손잡이 */}
        <div className="absolute -right-3 top-5 h-12 w-4 border-[5px] border-blue-300 rounded-r-full" />
        {/* 텍스트 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-xl font-black text-zinc-800 drop-shadow">{percentage}%</span>
          <span className="text-xs font-bold text-zinc-500 drop-shadow-sm">남음</span>
        </div>
      </div>
    </div>
  )
}

// ── 이모지 격자 ───────────────────────────────────────────────
function EmojiViz({
  percentage,
  emoji,
  onPickerToggle,
  showPicker,
  onSelectEmoji,
}: {
  percentage: number
  emoji: string
  onPickerToggle: () => void
  showPicker: boolean
  onSelectEmoji: (e: string) => void
}) {
  // 10개 중 남은 개수: 0~100% → 0~10개
  const remaining = Math.max(0, Math.min(10, Math.round(percentage / 10)))

  return (
    <div className="py-4 px-2">
      {/* 이모지 격자 */}
      <div className="grid grid-cols-5 gap-3 px-4">
        {Array.from({ length: 10 }, (_, i) => {
          const filled = i < remaining
          return (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center rounded-2xl transition-all duration-500 ${
                filled ? 'bg-white shadow-sm ring-1 ring-zinc-100' : 'bg-zinc-50'
              }`}
            >
              <span
                className={`text-3xl select-none transition-all duration-700 ${
                  filled ? 'scale-100' : 'opacity-[0.12] scale-90 grayscale'
                }`}
              >
                {emoji}
              </span>
            </div>
          )
        })}
      </div>

      {/* 설명 텍스트 */}
      <p className="text-center text-sm font-bold text-zinc-400 mt-4">
        {remaining > 0 ? (
          <>
            <span className="text-zinc-700">{remaining}개</span> 남았어요 (10개 중)
          </>
        ) : (
          '이번 달 예산을 모두 사용했어요'
        )}
      </p>

      {/* 이모지 바꾸기 버튼 */}
      <div className="flex justify-center mt-3 pb-1">
        <button
          onClick={onPickerToggle}
          className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${
            showPicker
              ? 'bg-zinc-800 text-white'
              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
          }`}
        >
          {showPicker ? '닫기 ✕' : '이모지 바꾸기 ✏️'}
        </button>
      </div>

      {/* 이모지 선택기 */}
      {showPicker && (
        <div className="grid grid-cols-6 gap-2 px-2 pt-3 pb-2 mt-1 border-t border-zinc-100 animate-fade-in-up">
          {EMOJI_CHOICES.map(({ emoji: e, name }) => (
            <button
              key={e}
              onClick={() => onSelectEmoji(e)}
              title={name}
              aria-label={name}
              aria-pressed={emoji === e}
              className={`aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all ${
                emoji === e
                  ? 'bg-zinc-900 ring-2 ring-zinc-900 ring-offset-1 scale-110'
                  : 'bg-zinc-100 hover:bg-zinc-200 active:scale-95'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 주간 막대 차트 ─────────────────────────────────────────────
function WeeklyChart({
  dailyTransactions,
  themeColor,
}: {
  dailyTransactions: DailyTransaction[]
  themeColor: string
}) {
  const c = THEME[(themeColor as ThemeKey)] ?? THEME.zinc
  const today = new Date()
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const dailyTotals = last7Days.map(date => {
    const txs = dailyTransactions.filter(t => t.date === date)
    return {
      date,
      label: `${Number(date.split('-')[1])}/${Number(date.split('-')[2])}`,
      total: txs.reduce((s, t) => s + Number(t.amount), 0),
      transactions: txs,
    }
  })

  const maxDaily = Math.max(...dailyTotals.map(d => d.total), 1)
  const todayStr = today.toISOString().split('T')[0]
  const selectedTxs = selectedDay
    ? dailyTotals.find(d => d.date === selectedDay)?.transactions ?? []
    : []

  return (
    <div className="pt-4 border-t border-zinc-100">
      <h4 className="text-xs font-black text-zinc-300 uppercase tracking-widest px-6 mb-4">
        이번 주 지출
      </h4>

      {/* 막대 차트 */}
      <div className="flex items-end gap-1.5 h-32 px-6">
        {dailyTotals.map(day => {
          const barH = day.total > 0 ? Math.max((day.total / maxDaily) * 100, 8) : 3
          const isSelected = selectedDay === day.date
          const isToday = day.date === todayStr

          return (
            <button
              key={day.date}
              onClick={() => setSelectedDay(isSelected ? null : day.date)}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              {day.total > 0 && (
                <span
                  className={`text-[9px] font-black transition-opacity ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  style={{ color: c.fill }}
                >
                  {formatCurrency(day.total)}
                </span>
              )}
              <div
                className={`w-full rounded-xl transition-all duration-500 ${
                  isSelected ? 'ring-2 ring-offset-1' : 'hover:opacity-80'
                }`}
                style={{
                  height: `${barH}%`,
                  background:
                    day.total > 0
                      ? isToday
                        ? c.fill
                        : `${c.fill}88`
                      : '#f4f4f5',
                }}
              />
              <span
                className={`text-[9px] font-bold ${isToday ? 'font-black' : 'text-zinc-400'}`}
                style={{ color: isToday ? c.fill : undefined }}
              >
                {day.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* 선택된 날 내역 */}
      {selectedDay && (
        <div className="mt-4 px-6 pb-5 animate-fade-in-up">
          {selectedTxs.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h5 className="text-xs font-black text-zinc-400 mb-1">
                {selectedDay.split('-')[1]}월 {selectedDay.split('-')[2]}일
              </h5>
              {selectedTxs.map((tx, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50">
                  {tx.receipt_image_url ? (
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
                      <img src={tx.receipt_image_url} alt="영수증" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${
                        tx.status === 'confirmed'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-orange-50 text-orange-500'
                      }`}
                    >
                      {tx.status === 'confirmed' ? '✓' : '⏳'}
                    </div>
                  )}
                  <p className="flex-1 font-bold text-zinc-800 text-sm truncate">
                    {tx.activity_name}
                  </p>
                  <span className="font-black text-zinc-900 text-sm shrink-0">
                    -{formatCurrency(Number(tx.amount))}원
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <span className="text-3xl opacity-30">💤</span>
              <p className="text-sm text-zinc-400 font-bold mt-2">이 날은 지출이 없었어요</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 위젯 ─────────────────────────────────────────────────
export default function BalanceVisualWidget({
  currentBalance,
  totalBudget,
  percentage,
  themeColor,
  icon,
  statusMessage,
  remainingDays,
  dailyTransactions = [],
}: Props) {
  const [style, setStyle] = useState<WidgetStyle>('pouch')
  const [selectedEmoji, setSelectedEmoji] = useState('🍎')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showWeekly, setShowWeekly] = useState(false)

  useEffect(() => {
    const s = localStorage.getItem('balance-widget-style') as WidgetStyle | null
    const e = localStorage.getItem('balance-widget-emoji')
    if (s) setStyle(s)
    if (e) setSelectedEmoji(e)
  }, [])

  const changeStyle = (s: WidgetStyle) => {
    setStyle(s)
    localStorage.setItem('balance-widget-style', s)
    if (s !== 'emoji') setShowEmojiPicker(false)
  }

  const changeEmoji = (e: string) => {
    setSelectedEmoji(e)
    localStorage.setItem('balance-widget-emoji', e)
    setShowEmojiPicker(false)
  }

  const c = THEME[(themeColor as ThemeKey)] ?? THEME.zinc

  return (
    <section className="rounded-[2.5rem] bg-white ring-1 ring-zinc-100 shadow-lg overflow-hidden">
      {/* 헤더: 잔액 + 스타일 전환 */}
      <div className="flex items-start justify-between px-6 pt-6 pb-2">
        <div>
          <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">
            나의 돈주머니
          </p>
          <p className={`text-4xl font-black mt-1 ${c.text}`}>
            {formatCurrency(currentBalance)}원
          </p>
          <p className="text-sm text-zinc-400 font-bold mt-0.5">
            {remainingDays}일 남음 · {percentage}%
          </p>
        </div>

        {/* 스타일 전환 버튼 */}
        <div className="flex flex-col gap-1.5 pt-1">
          {(
            [
              { key: 'pouch' as WidgetStyle, label: '💰', title: '돈주머니' },
              { key: 'water' as WidgetStyle, label: '🥤', title: '물컵' },
              { key: 'emoji' as WidgetStyle, label: '✨', title: '이모지' },
            ] as const
          ).map(opt => (
            <button
              key={opt.key}
              onClick={() => changeStyle(opt.key)}
              aria-label={opt.title}
              aria-pressed={style === opt.key}
              className={`w-10 h-10 rounded-xl text-lg transition-all duration-200 ${
                style === opt.key
                  ? 'bg-zinc-900 shadow-md scale-110'
                  : 'bg-zinc-100 hover:bg-zinc-200 active:scale-95'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 게이지 바 */}
      <div className="px-6 pb-4">
        <div
          className="h-3 w-full rounded-full overflow-hidden"
          style={{ background: `${c.fill}22` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${percentage}%`, background: c.fill }}
          />
        </div>
      </div>

      {/* 시각화 영역 */}
      <div style={{ background: `linear-gradient(to bottom, white, ${c.light}33)` }}>
        {style === 'pouch' && (
          <PouchViz percentage={percentage} themeColor={themeColor} icon={icon} />
        )}
        {style === 'water' && <WaterViz percentage={percentage} />}
        {style === 'emoji' && (
          <EmojiViz
            percentage={percentage}
            emoji={selectedEmoji}
            showPicker={showEmojiPicker}
            onPickerToggle={() => setShowEmojiPicker(p => !p)}
            onSelectEmoji={changeEmoji}
          />
        )}
      </div>

      {/* 상태 메시지 */}
      <div className={`px-6 py-4 flex items-center gap-3 ${c.bg} border-t ${c.border}`}>
        <span className="text-2xl shrink-0">{icon}</span>
        <p className="text-sm font-bold text-zinc-700 leading-snug break-keep">{statusMessage}</p>
      </div>

      {/* 주간 지출 토글 */}
      {dailyTransactions.length > 0 && (
        <div className="border-t border-zinc-100">
          <button
            onClick={() => setShowWeekly(p => !p)}
            className="w-full flex items-center justify-between px-6 py-4 text-xs font-black text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors"
            aria-expanded={showWeekly}
          >
            <span>이번 주 지출 보기</span>
            <span
              className={`transition-transform duration-300 ${showWeekly ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          </button>

          <div
            className={`transition-all duration-500 overflow-hidden ${
              showWeekly ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <WeeklyChart dailyTransactions={dailyTransactions} themeColor={themeColor} />
          </div>
        </div>
      )}
    </section>
  )
}
