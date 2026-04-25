'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/utils/budget-visuals'
import { createTransaction } from '@/app/actions/transaction'
import { analyzeReceipt } from '@/app/actions/ocr'
import { EasyTerm } from '@/components/ui/EasyTerm'
import { speak } from '@/utils/tts'
import {
  loadEmojiCatalog, searchEmoji, getEmojisByGroup,
  GROUP_LABELS, GROUP_ORDER,
  type EmojiEntry,
} from '@/utils/emojiCatalog'
import CashViz from './BalanceCashViz'
import MonthlyPlanMiniProgress from './MonthlyPlanMiniProgress'

type WidgetStyle = 'pie' | 'water' | 'emoji' | 'text' | 'cash'

const DEFAULT_EMOJI_FAVORITES = ['🍎', '🍪', '⭐', '🐥', '🌸', '🎈', '🍋', '🍩', '🦊', '🎀']

const THEME = {
  green:  { fill: '#22c55e', stroke: '#16a34a', light: '#dcfce7', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' },
  blue:   { fill: '#3b82f6', stroke: '#2563eb', light: '#dbeafe', text: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-100' },
  yellow: { fill: '#ca8a04', stroke: '#a16207', light: '#fef9c3', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-100' },
  indigo: { fill: '#6366f1', stroke: '#4f46e5', light: '#e0e7ff', text: 'text-indigo-700', bg: 'bg-zinc-50', border: 'border-zinc-100' },
  orange: { fill: '#f97316', stroke: '#ea580c', light: '#ffedd5', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100' },
  red:    { fill: '#ef4444', stroke: '#dc2626', light: '#fee2e2', text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-100' },
  zinc:   { fill: '#71717a', stroke: '#52525b', light: '#f4f4f5', text: 'text-zinc-700',  bg: 'bg-zinc-50',  border: 'border-zinc-100' },
} as const

type ThemeKey = keyof typeof THEME

/* ── 시뮬레이션 접기/프리셋 섹션 ── */
const SIM_PRESETS = [10000, 30000, 50000]

function SimulationSection({
  simAmount, setSimAmount, simValue, simBalance, isSimOver, displayBalance,
}: {
  simAmount: string
  setSimAmount: (v: string) => void
  simValue: number
  simBalance: number
  isSimOver: boolean
  displayBalance: number
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="px-5 pb-3 pt-1">
        <button
          onClick={() => setOpen(true)}
          className="w-full py-3 rounded-2xl bg-zinc-50 ring-1 ring-zinc-100
            text-sm font-bold text-zinc-400 hover:bg-zinc-100 transition-all
            flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          🛍️ 이만큼 사면 얼마 남을까?
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 pb-4 pt-2 flex flex-col gap-3">
      {/* 프리셋 버튼 */}
      <div className="flex gap-2">
        {SIM_PRESETS.map(amount => {
          const colors: Record<number, { base: string; active: string }> = {
            10000: { base: 'bg-green-50 text-green-700 hover:bg-green-100 ring-1 ring-green-200', active: 'bg-green-600 text-white shadow-md ring-1 ring-green-600' },
            30000: { base: 'bg-blue-50 text-blue-700 hover:bg-blue-100 ring-1 ring-blue-200', active: 'bg-blue-600 text-white shadow-md ring-1 ring-blue-600' },
            50000: { base: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 ring-1 ring-yellow-200', active: 'bg-yellow-500 text-white shadow-md ring-1 ring-yellow-500' },
          }
          const c = colors[amount] || { base: 'bg-zinc-100 text-zinc-600', active: 'bg-zinc-900 text-white' }
          const isActive = simValue === amount

          return (
            <button
              key={amount}
              onClick={() => setSimAmount(isActive ? '' : String(amount))}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all active:scale-95 ${
                isActive ? c.active : c.base
              }`}
            >
              {formatCurrency(amount)}원
            </button>
          )
        })}
      </div>

      {/* 직접 입력 */}
      <details className="text-xs">
        <summary className="text-zinc-400 cursor-pointer font-bold">
          다른 금액 직접 적기
        </summary>
        <div className="mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl ring-1 ring-zinc-100 bg-zinc-50">
          <span className="text-lg shrink-0">🛍️</span>
          <input
            type="number"
            inputMode="numeric"
            step={1000}
            value={simAmount}
            onChange={e => setSimAmount(e.target.value)}
            placeholder="금액을 써요"
            className="flex-1 bg-transparent outline-none text-sm font-bold text-zinc-700 placeholder:text-zinc-300 min-w-0"
          />
          <span className="text-sm font-bold text-zinc-400 shrink-0">원</span>
        </div>
      </details>

      {/* 결과 표시 */}
      {simValue > 0 && (
        <div className={`p-4 rounded-2xl flex items-center justify-between ${isSimOver ? 'bg-red-50' : 'bg-zinc-50'}`}>
          <span className="text-xs text-zinc-400 font-bold">
            <EasyTerm formal="구매 후 잔액" easy="사고 남는 돈" />
          </span>
          <span className={`text-sm font-black ${isSimOver ? 'text-red-500' : 'text-zinc-800'}`}>
            {isSimOver ? '돈이 부족해요 ❌' : `${formatCurrency(simBalance)}원`}
          </span>
        </div>
      )}

      {/* 닫기 */}
      <button
        onClick={() => { setOpen(false); setSimAmount('') }}
        className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-sm font-black text-zinc-600 transition-colors active:scale-[0.98]"
      >
        닫기
      </button>
    </div>
  )
}

interface Props {
  currentBalance: number
  totalBudget: number
  percentage: number
  themeColor: string
  icon: string
  statusMessage: string
  remainingDays: number
  participantId?: string
  fundingSources?: { id: string; name: string }[]
  monthlyPlanProgress?: import('@/app/actions/monthlyPlan').MonthlyPlanProgress[]
  currentMonth?: string
}

// ── 피자 그래프 ────────────────────────────────────────────────
function PizzaChart({
  percentage,
  displayBalance,
  pendingPct = 0,
}: {
  percentage: number
  displayBalance: number
  pendingPct?: number
}) {
  const circumference = 2 * Math.PI * 25
  const offset = circumference - circumference * Math.max(0, Math.min(1, percentage / 100))

  // pending 호: 피자 끝 지점에서 빈 영역 쪽으로 점선 호를 표시 (빠질 예정 영역)
  const pendingClamped = Math.max(0, Math.min(100 - percentage, pendingPct))
  const pendingArcLen = circumference * (pendingClamped / 100)
  // 호가 시작할 위치(피자 끝) = C * pct/100
  // strokeDashoffset = pendingArcLen + C*(1 - pct/100) 가 올바른 공식
  const pendingDashOffset = pendingArcLen + circumference * (1 - percentage / 100)

  const balanceText = formatCurrency(displayBalance)
  const longText = balanceText.length >= 7

  return (
    <div className="flex items-center justify-center py-5">
      <div className="relative w-40 h-40 lg:w-52 lg:h-52">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 drop-shadow-md">
          {/* 접시 */}
          <circle cx="50" cy="50" r="48" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="42" fill="#f3f4f6" />

          {/* 피자 마스크 */}
          <mask id="pizza-bvw">
            <circle
              cx="50" cy="50" r="25"
              fill="none" stroke="white" strokeWidth="50"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
            />
          </mask>

          {/* 피자 */}
          <g mask="url(#pizza-bvw)">
            <circle cx="50" cy="50" r="44" fill="#d97706" />
            <circle cx="50" cy="50" r="38" fill="#facc15" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="1.5" />
            {/* 페페로니 */}
            <circle cx="30" cy="35" r="4.5" fill="#ef4444" />
            <circle cx="70" cy="30" r="5"   fill="#ef4444" />
            <circle cx="50" cy="20" r="4.5" fill="#ef4444" />
            <circle cx="55" cy="70" r="5"   fill="#ef4444" />
            <circle cx="35" cy="65" r="4"   fill="#ef4444" />
            <circle cx="75" cy="55" r="4.5" fill="#ef4444" />
            <circle cx="50" cy="50" r="4"   fill="#ef4444" />
            {/* 허브 */}
            <path d="M 40 40 Q 42 38 45 40 Q 42 42 40 40" fill="#22c55e" />
            <path d="M 60 60 Q 62 58 65 60 Q 62 62 60 60" fill="#22c55e" />
            <path d="M 30 50 Q 32 48 35 50 Q 32 52 30 50" fill="#22c55e" />
          </g>

          {/* pending 호 — 피자 끝 바로 다음 영역, 반투명 주황 */}
          {pendingClamped > 0 && (
            <circle
              cx="50" cy="50" r="25"
              fill="none"
              stroke="#fb923c"
              strokeWidth="50"
              strokeDasharray={`${pendingArcLen} ${circumference}`}
              strokeDashoffset={pendingDashOffset}
              opacity="0.45"
              style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
            />
          )}
        </svg>

        {/* 중앙 레이블 — 금액 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-2xl shadow-md border border-white/80 text-center max-w-[85%]">
            <span className="text-[10px] font-bold text-zinc-500 block leading-tight">
              <EasyTerm formal="잔액" easy="남은 돈" />
            </span>
            <span className={`${longText ? 'text-base' : 'text-xl'} font-black text-zinc-900 leading-tight block`}>
              {balanceText}
            </span>
            <span className="text-[10px] font-bold text-zinc-600 block leading-tight">원</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 물컵 그래프 ───────────────────────────────────────────────
function WaterViz({
  percentage,
  currentBalance,
  pendingPct = 0,
}: {
  percentage: number
  currentBalance: number
  pendingPct?: number
}) {
  const isLow = percentage < 25
  const waterColor = isLow ? '#f87171' : '#3b82f6'
  const waveBg   = isLow ? 'bg-red-400'  : 'bg-blue-400'
  const cupBorder = isLow ? 'border-red-200' : 'border-blue-200'
  const fillH = Math.max(5, percentage)
  const pendingClamped = Math.max(0, Math.min(pendingPct, 100 - fillH))

  const balanceText = formatCurrency(currentBalance)
  const longText = balanceText.length >= 7

  return (
    <div className="flex flex-col items-center justify-center w-full py-4 pb-5 gap-3">
      <div
        className={`relative w-28 h-40 lg:w-36 lg:h-52 rounded-b-[2rem] border-4 border-t-0 ${cupBorder} bg-blue-50/30 overflow-hidden shadow-inner`}
      >
        {/* 물 */}
        <div
          className="absolute bottom-0 w-full transition-all duration-700 ease-out"
          style={{ height: `${fillH}%`, backgroundColor: waterColor }}
        >
          {/* 물결 */}
          <div
            className={`absolute top-0 left-0 right-0 h-4 ${waveBg} opacity-50 -translate-y-1/2 rounded-[50%]`}
          />
          <div className="absolute top-0 left-3 right-3 h-2 bg-white/30 -translate-y-1/2 rounded-[50%]" />
        </div>

        {/* pending 점선 영역 — 곧 빠질 물 */}
        {pendingClamped > 0 && (
          <div
            className="absolute left-0 right-0 border-t-2 border-b-2 border-dashed border-orange-400/70 bg-orange-200/30 transition-all duration-700 ease-out"
            style={{
              bottom: `${fillH}%`,
              height: `${pendingClamped}%`,
            }}
          />
        )}

        {/* 눈금선 */}
        <div className="absolute bottom-1/4 left-0 w-3 h-px bg-blue-200/80" />
        <div className="absolute bottom-2/4 left-0 w-5 h-px bg-blue-200/80" />
        <div className="absolute bottom-3/4 left-0 w-3 h-px bg-blue-200/80" />

        {/* 컵 손잡이 */}
        <div className={`absolute -right-3 top-6 h-12 w-4 border-4 ${cupBorder} rounded-r-full`} />

        {/* 중앙 레이블 — 금액 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-2">
          <div className="bg-white/90 backdrop-blur-sm px-2 py-1.5 rounded-xl shadow-sm text-center">
            <span className={`${longText ? 'text-sm' : 'text-base'} font-black text-zinc-900 leading-none block`}>
              {balanceText}
            </span>
            <span className="text-[9px] font-bold text-zinc-500 block leading-tight">원</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <span className="text-xs font-medium text-zinc-500">남은 물 (예산)</span>
        <p className={`text-xl font-black mt-0.5 ${isLow ? 'text-red-600' : 'text-blue-600'}`}>
          {formatCurrency(currentBalance)}원
        </p>
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
  const remaining = Math.max(0, Math.min(10, Math.round(percentage / 10)))

  // 즐겨찾기 (localStorage, 최대 10개)
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_EMOJI_FAVORITES
    try {
      const saved = localStorage.getItem('emoji-favorites')
      const parsed = saved ? JSON.parse(saved) : null
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_EMOJI_FAVORITES
    } catch { return DEFAULT_EMOJI_FAVORITES }
  })

  // 카탈로그 — 피커가 처음 열릴 때 lazy load
  const [catalog, setCatalog] = useState<EmojiEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)

  // 탭: 'fav' | 'search' | group key
  const [tab, setTab] = useState<string>('fav')
  const [searchQuery, setSearchQuery] = useState('')

  // 피커가 열릴 때 카탈로그 로드
  useEffect(() => {
    if (!showPicker || catalog.length > 0 || catalogLoading) return
    setCatalogLoading(true)
    loadEmojiCatalog().then(data => {
      setCatalog(data)
      setCatalogLoading(false)
    })
  }, [showPicker, catalog.length, catalogLoading])

  function saveFavorites(next: string[]) {
    setFavorites(next)
    localStorage.setItem('emoji-favorites', JSON.stringify(next))
  }

  function addFavorite(e: string) {
    if (!e || favorites.includes(e) || favorites.length >= 10) return
    saveFavorites([...favorites, e])
  }

  function removeFavorite(e: string) {
    saveFavorites(favorites.filter(f => f !== e))
  }

  function pickEmoji(e: string) {
    addFavorite(e)
    onSelectEmoji(e)
  }

  function isEmojiChar(str: string) {
    return /\p{Emoji}/u.test(str.trim()) && str.trim().length <= 4
  }

  const searchResults = searchQuery.trim().length > 0 && catalog.length > 0
    ? searchEmoji(catalog, searchQuery)
    : []

  const browseGroup = catalog.length > 0 && tab !== 'fav' && tab !== 'search'
    ? getEmojisByGroup(catalog, tab)
    : []

  const TABS = [
    { key: 'fav', label: '⭐ 즐겨찾기' },
    { key: 'search', label: '🔍 검색' },
    ...GROUP_ORDER.slice(0, 6).map(g => ({
      key: g,
      label: `${GROUP_LABELS[g]?.icon} ${GROUP_LABELS[g]?.label}`,
    })),
  ]

  return (
    <div className="py-4 px-3">
      {/* 이모지 격자 */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3 px-2">
        {Array.from({ length: 10 }, (_, i) => {
          const filled = i < remaining
          return (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center rounded-2xl transition-all duration-500 ${
                filled ? 'bg-white shadow-sm ring-1 ring-zinc-100' : 'bg-zinc-50'
              }`}
            >
              <span className={`text-3xl select-none transition-all duration-700 ${
                filled ? 'scale-100' : 'opacity-[0.12] scale-90 grayscale'
              }`}>{emoji}</span>
            </div>
          )
        })}
      </div>

      <p className="text-center text-sm font-bold text-zinc-400 mt-4">
        {remaining > 0 ? (
          <><span className="text-zinc-700">{remaining}개</span> 남았어요 (10개 중)</>
        ) : '이번 달 예산을 모두 사용했어요'}
      </p>

      <div className="flex justify-center mt-3 pb-1">
        <button
          onClick={onPickerToggle}
          className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${
            showPicker ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
          }`}
        >
          {showPicker ? '닫기 ✕' : '이모지 바꾸기 ✏️'}
        </button>
      </div>

      {showPicker && (
        <div className="mt-2 border-t border-zinc-100 animate-fade-in-up">
          {/* 탭 스크롤 */}
          <div className="flex gap-1 overflow-x-auto py-2 px-1 no-scrollbar">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  tab === t.key ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-1 pb-2">
            {/* 즐겨찾기 탭 */}
            {tab === 'fav' && (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-black text-zinc-400 tracking-wider">
                  즐겨찾기 ({favorites.length}/10) — 길게 눌러 삭제
                </p>
                {favorites.length === 0 ? (
                  <p className="text-xs text-zinc-300 text-center py-4">
                    검색이나 카테고리에서 이모지를 추가해보세요
                  </p>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {favorites.map(e => (
                      <div key={e} className="relative group">
                        <button
                          onClick={() => onSelectEmoji(e)}
                          aria-pressed={emoji === e}
                          className={`w-full aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all ${
                            emoji === e
                              ? 'bg-zinc-900 ring-2 ring-zinc-900 ring-offset-1 scale-110'
                              : 'bg-zinc-100 hover:bg-zinc-200 active:scale-95'
                          }`}
                        >{e}</button>
                        <button
                          onClick={() => removeFavorite(e)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="삭제"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 검색 탭 */}
            {tab === 'search' && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="영어 이름 검색 (예: cat, apple) 또는 이모지 붙여넣기"
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-900 focus:outline-none"
                    autoFocus
                  />
                  {isEmojiChar(searchQuery) && (
                    <button
                      onClick={() => { pickEmoji(searchQuery.trim()); setSearchQuery('') }}
                      disabled={favorites.includes(searchQuery.trim()) || favorites.length >= 10}
                      className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold disabled:bg-zinc-300 shrink-0"
                    >
                      {emoji === searchQuery.trim() ? '선택됨' : '추가'}
                    </button>
                  )}
                </div>
                {catalogLoading && (
                  <p className="text-xs text-zinc-400 text-center py-2">이모지 데이터 로딩 중...</p>
                )}
                {searchResults.length > 0 && (
                  <div className="grid grid-cols-6 gap-1.5">
                    {searchResults.map(({ emoji: e, slug }) => (
                      <button
                        key={e}
                        onClick={() => pickEmoji(e)}
                        title={slug.replace(/_/g, ' ')}
                        className={`aspect-square rounded-xl flex items-center justify-center text-2xl transition-all active:scale-95 ${
                          favorites.includes(e)
                            ? 'bg-zinc-200 ring-1 ring-zinc-400'
                            : 'bg-zinc-50 hover:bg-blue-50 hover:ring-1 hover:ring-blue-200'
                        }`}
                      >{e}</button>
                    ))}
                  </div>
                )}
                {!catalogLoading && searchQuery.trim() && searchResults.length === 0 && (
                  <p className="text-xs text-zinc-400 text-center py-2">
                    결과 없음 — 이모지를 직접 붙여넣거나 영어 키워드로 검색하세요
                  </p>
                )}
              </div>
            )}

            {/* 카테고리 탭 */}
            {tab !== 'fav' && tab !== 'search' && (
              <div>
                {catalogLoading ? (
                  <p className="text-xs text-zinc-400 text-center py-4">로딩 중...</p>
                ) : (
                  <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
                    {browseGroup.map(({ emoji: e, slug }) => (
                      <button
                        key={e}
                        onClick={() => pickEmoji(e)}
                        title={slug.replace(/_/g, ' ')}
                        className={`aspect-square rounded-lg flex items-center justify-center text-xl transition-all active:scale-95 ${
                          favorites.includes(e)
                            ? 'bg-zinc-200 ring-1 ring-zinc-300'
                            : 'hover:bg-zinc-100'
                        } ${emoji === e ? 'ring-2 ring-zinc-900 scale-110' : ''}`}
                      >{e}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 숫자/텍스트 표시 모드 ────────────────────────────────────────
function TextViz({ percentage, currentBalance }: { percentage: number; currentBalance: number }) {
  const isLow = percentage < 30
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 gap-2">
      <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.2em]">남은 예산</p>
      <p className={`text-8xl font-black leading-none hc-amount ${isLow ? 'text-red-600' : 'text-zinc-900'}`}>
        {percentage}<EasyTerm formal="%" easy="퍼센트" />
      </p>
      <p className={`text-3xl font-bold mt-2 hc-amount ${isLow ? 'text-red-500' : 'text-zinc-500'}`}>
        {formatCurrency(currentBalance)}원
      </p>
      {isLow && (
        <p className="text-sm font-bold text-red-500 mt-1">돈이 얼마 없어요</p>
      )}
    </div>
  )
}

// ── 메인 위젯 ─────────────────────────────────────────────────────
export default function BalanceVisualWidget({
  currentBalance,
  totalBudget,
  percentage,
  themeColor,
  icon,
  statusMessage,
  remainingDays,
  participantId,
  fundingSources = [],
  monthlyPlanProgress = [],
  currentMonth,
}: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [style, setStyle] = useState<WidgetStyle>('pie')
  const [selectedEmoji, setSelectedEmoji] = useState('🍎')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // 낙관적(optimistic) 잔액 차감 — 임시 저장 즉시 반영
  const [pendingDeduction, setPendingDeduction] = useState(0)
  useEffect(() => { setPendingDeduction(0) }, [currentBalance])

  // 금액 시뮬레이션 — "이만큼 사면 얼마나 남을까?"
  const [simAmount, setSimAmount] = useState('')

  // 화면에 보여줄 실제 잔액 (부드러운 전환 적용)
  const targetBalance = Math.max(0, currentBalance - pendingDeduction)
  const [displayBalance, setDisplayBalance] = useState(targetBalance)
  const displayRef = useRef(targetBalance)

  useEffect(() => {
    const start = displayRef.current
    const end = targetBalance
    if (start === end) return
    const duration = 500
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)  // easeOutCubic
      const current = Math.round(start + (end - start) * eased)
      displayRef.current = current
      setDisplayBalance(current)
      if (progress < 1) rafId = requestAnimationFrame(animate)
    }

    let rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [targetBalance])

  const displayPct = totalBudget > 0 ? Math.round((displayBalance / totalBudget) * 100) : percentage

  // 시뮬레이션 적용 퍼센트 (차트에 반영)
  const simValue = parseFloat(simAmount.replace(/,/g, '')) || 0
  const activePct = simValue > 0
    ? Math.max(0, Math.round(((displayBalance - simValue) / totalBudget) * 100))
    : displayPct
  const simBalance = Math.max(0, displayBalance - simValue)
  const isSimOver = simValue > 0 && simValue > displayBalance

  // 인라인 업로드 상태
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const activityInputRef = useRef<HTMLInputElement>(null)
  const secondFileRef = useRef<HTMLInputElement>(null)  // 두 번째 파일 (추가 사진)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [uploadMode, setUploadMode] = useState<'receipt' | 'activity' | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadAnalyzing, setUploadAnalyzing] = useState(false)
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadAmount, setUploadAmount] = useState('')
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0])
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const [uploadToast, setUploadToast] = useState<string | null>(null)
  // 두 번째 파일 (영수증+활동사진 동시)
  const [secondFile, setSecondFile] = useState<File | null>(null)
  const [secondPreview, setSecondPreview] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const raw = localStorage.getItem('balance-widget-style') as string | null
    // 구버전 'pouch' → 새 버전 'pie'로 마이그레이션
    const s = raw === 'pouch' ? 'pie' : (raw as WidgetStyle | null)
    const e = localStorage.getItem('balance-widget-emoji')
    if (s && ['pie', 'water', 'cash', 'emoji', 'text'].includes(s)) setStyle(s)
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

  // ── 인라인 업로드 핸들러 ──────────────────────────────────────
  const handleInlineUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'receipt' | 'activity'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    setUploadMode(mode)
    setUploadDescription('')
    setUploadAmount('')
    setUploadDate(new Date().toISOString().split('T')[0])
    setUploadToast(null)

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1]
      setUploadPreview(reader.result as string)

      // 영수증 모드일 때만 OCR 분석
      if (mode === 'receipt') {
        setUploadAnalyzing(true)
        try {
          const result = await analyzeReceipt(base64)
          if (result.success && result.data) {
            setUploadDescription(result.data.store || '')
            setUploadAmount(String(result.data.amount || ''))
            if (result.data.date) setUploadDate(result.data.date)
          }
        } catch (err) {
          console.error('OCR 분석 실패:', err)
        } finally {
          setUploadAnalyzing(false)
        }
      }
    }
    reader.readAsDataURL(file)
    // input 리셋 (같은 파일 재선택 가능)
    e.target.value = ''
  }

  const closeUploadSheet = () => {
    setUploadMode(null)
    setUploadPreview(null)
    setUploadFile(null)
    setUploadDescription('')
    setUploadAmount('')
    setUploadAnalyzing(false)
    setUploadToast(null)
    setSecondFile(null)
    setSecondPreview(null)
  }

  const handleSecondFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSecondFile(file)
    const reader = new FileReader()
    reader.onloadend = async () => {
      setSecondPreview(reader.result as string)
      // 활동사진이 첫 번째 파일일 때 두 번째 파일(영수증)에 OCR 실행
      if (uploadMode === 'activity') {
        const base64 = (reader.result as string).split(',')[1]
        setUploadAnalyzing(true)
        try {
          const result = await analyzeReceipt(base64)
          if (result.success && result.data) {
            if (result.data.store) setUploadDescription(result.data.store)
            if (result.data.amount) setUploadAmount(String(result.data.amount))
            if (result.data.date) setUploadDate(result.data.date)
          }
        } catch (err) {
          console.error('OCR 분석 실패:', err)
        } finally {
          setUploadAnalyzing(false)
        }
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // 이미지를 최대 1000px, JPEG 82%로 압축한다. 실패 시 원본 파일을 그대로 반환한다.
  function compressImage(file: File, maxPx = 1000): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      // 로드 실패 시 원본 반환
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }

      img.onload = () => {
        URL.revokeObjectURL(url)
        try {
          const longest = Math.max(img.width, img.height)
          if (longest === 0) { resolve(file); return }
          const scale = Math.min(1, maxPx / longest)
          const canvas = document.createElement('canvas')
          canvas.width  = Math.max(1, Math.round(img.width  * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(file); return }   // Canvas 2D 미지원 시 원본 반환
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(
            (blob) => {
              if (!blob) { resolve(file); return }  // toBlob 실패 시 원본 반환
              const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg'
              resolve(new File([blob], name, { type: 'image/jpeg' }))
            },
            'image/jpeg',
            0.82
          )
        } catch {
          resolve(file)  // canvas 조작 오류 시 원본 반환
        }
      }
      img.src = url
    })
  }

  const handleInlineSubmit = async () => {
    if (!participantId || !uploadFile) return
    setUploadSubmitting(true)
    const amountNum = parseFloat(uploadAmount) || 0
    if (amountNum > 0) setPendingDeduction(prev => prev + amountNum)
    try {
      // 순차 압축 (병렬 시 모바일에서 canvas 메모리 초과 가능)
      const mainCompressed   = await compressImage(uploadFile)
      const secondCompressed = secondFile ? await compressImage(secondFile) : null

      const formData = new FormData()
      formData.set('participant_id', participantId)
      formData.set('date', uploadDate)
      formData.set('description', uploadDescription)
      formData.set('amount', uploadAmount)
      if (fundingSources.length > 0) {
        formData.set('funding_source_id', fundingSources[0].id)
      }
      if (uploadMode === 'receipt') {
        formData.set('receipt', mainCompressed)
        if (secondCompressed) formData.set('activity_image', secondCompressed)
      } else {
        formData.set('activity_image', mainCompressed)
        if (secondCompressed) formData.set('receipt', secondCompressed)
      }
      const result = await createTransaction(formData)
      if (result.success) {
        setUploadToast('활동을 기록했어요! ✅')
        setTimeout(() => {
          closeUploadSheet()
          router.refresh()
        }, 1200)
      } else {
        if (amountNum > 0) setPendingDeduction(prev => Math.max(0, prev - amountNum))
        setUploadToast('기록이 안 되었어요. 다시 눌러 주세요.')
      }
    } catch (err) {
      console.error('handleInlineSubmit 오류:', err)
      if (amountNum > 0) setPendingDeduction(prev => Math.max(0, prev - amountNum))
      setUploadToast('기록이 안 되었어요. 다시 눌러 주세요.')
    } finally {
      setUploadSubmitting(false)
    }
  }

  const c = THEME[(themeColor as ThemeKey)] ?? THEME.zinc

  const STYLE_OPTIONS = [
    { key: 'pie'   as WidgetStyle, label: '🍕', title: '피자 그래프', short: '피자' },
    { key: 'water' as WidgetStyle, label: '🥤', title: '물컵 그래프', short: '물컵' },
    { key: 'cash'  as WidgetStyle, label: '💵', title: '지폐·동전',   short: '현금' },
    { key: 'emoji' as WidgetStyle, label: '✨', title: '이모지',      short: '이모지' },
    { key: 'text'  as WidgetStyle, label: '🔢', title: '숫자 표시',   short: '숫자' },
  ]

  return (
    <section className="rounded-[2.5rem] bg-white ring-1 ring-zinc-100 shadow-lg overflow-hidden">
      {/* 헤더: 잔액 + 차트 전환 */}
      <div className="flex items-start justify-between px-5 pt-5 pb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.2em]">
            <EasyTerm formal="잔액 요약" easy="남은 돈" />
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-3xl font-black transition-all duration-500 leading-tight hc-amount ${c.text}`}>
              {formatCurrency(displayBalance)}<span className="text-xl">원</span>
            </p>
            <button
              onClick={() => speak(`남은 돈은 ${formatCurrency(displayBalance)}원입니다. 예산의 ${displayPct}퍼센트가 남아있습니다. ${remainingDays}일 남았습니다.`)}
              className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-sm active:scale-95 transition-all shrink-0"
              aria-label="잔액 음성으로 듣기"
              title="음성으로 듣기"
            >
              🔊
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
              📅 {remainingDays}일 남음
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
              💰 {displayPct}<EasyTerm formal="%" easy="퍼센트" /> 남음
            </span>
            {pendingDeduction > 0 && (
              <span className="text-orange-500 text-xs font-bold">⏳ 반영 중</span>
            )}
          </div>
        </div>

        {/* 차트 스타일 전환 (드롭다운) */}
        <div className="shrink-0 ml-2 mt-0.5 relative">
          <select
            value={style}
            onChange={(e) => changeStyle(e.target.value as WidgetStyle)}
            className="appearance-none bg-zinc-100 hover:bg-zinc-200 border-none text-zinc-700 text-xs font-bold rounded-xl pl-3 pr-8 py-2 focus:outline-none transition-colors cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2371717a%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.6rem top 50%',
              backgroundSize: '0.6rem auto',
            }}
            aria-label="잔액 요약 위젯 보기 방식 설정"
          >
            {STYLE_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>
                {opt.label} {opt.short}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 게이지 바 (시뮬레이션 시 2단 표시) */}
      <div className="px-5 pb-2">
        <div
          className="h-2.5 w-full rounded-full overflow-hidden relative"
          style={{ background: `${c.fill}22` }}
          role="progressbar"
          aria-valuenow={activePct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* 실제 잔액 바 */}
          <div
            className="h-full rounded-full transition-all duration-700 absolute inset-y-0 left-0"
            style={{ width: `${displayPct}%`, background: `${c.fill}55` }}
          />
          {/* 시뮬레이션 후 잔액 바 */}
          <div
            className="h-full rounded-full transition-all duration-700 absolute inset-y-0 left-0"
            style={{
              width: `${activePct}%`,
              background: isSimOver ? '#ef4444' : c.fill,
            }}
          />
        </div>
      </div>

      {/* 시각화 영역 — §4: 무광택 단색 */}
      <div style={{ background: c.light }}>
        {style === 'pie'   && (
          <PizzaChart
            percentage={activePct}
            displayBalance={simValue > 0 ? simBalance : displayBalance}
            pendingPct={simValue > 0 ? 0 : (totalBudget > 0 ? Math.round((pendingDeduction / totalBudget) * 100) : 0)}
          />
        )}
        {style === 'water' && (
          <WaterViz
            percentage={activePct}
            currentBalance={simValue > 0 ? simBalance : displayBalance}
            pendingPct={simValue > 0 ? 0 : (totalBudget > 0 ? Math.round((pendingDeduction / totalBudget) * 100) : 0)}
          />
        )}
        {style === 'cash' && (
          <CashViz
            displayBalance={simValue > 0 ? simBalance : displayBalance}
            pendingDeduction={simValue > 0 ? 0 : pendingDeduction}
            totalBudget={totalBudget}
          />
        )}
        {style === 'emoji' && (
          <EmojiViz
            percentage={activePct}
            emoji={selectedEmoji}
            showPicker={showEmojiPicker}
            onPickerToggle={() => setShowEmojiPicker(p => !p)}
            onSelectEmoji={changeEmoji}
          />
        )}
        {style === 'text' && <TextViz percentage={activePct} currentBalance={simValue > 0 ? simBalance : displayBalance} />}
      </div>

      {/* 금액 시뮬레이션 — 기본 접기 + 프리셋 버튼 */}
      <SimulationSection
        simAmount={simAmount}
        setSimAmount={setSimAmount}
        simValue={simValue}
        simBalance={simBalance}
        isSimOver={isSimOver}
        displayBalance={displayBalance}
      />

      {/* 상태 메시지 */}
      <div className={`px-5 py-3 flex items-center gap-3 ${c.bg} border-t ${c.border}`}>
        <span className="text-2xl shrink-0">{icon}</span>
        <p className="text-sm font-bold text-zinc-700 leading-snug break-keep">{statusMessage}</p>
      </div>

      {/* 이번 달 계획 진행 (있을 때만) */}
      {participantId && currentMonth && monthlyPlanProgress.length > 0 && (
        <MonthlyPlanMiniProgress
          participantId={participantId}
          month={currentMonth}
          plans={monthlyPlanProgress}
        />
      )}

      {/* 숨겨진 파일 입력 */}
      <input
        ref={receiptInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleInlineUpload(e, 'receipt')}
      />
      <input
        ref={activityInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleInlineUpload(e, 'activity')}
      />

      {/* FAB + 인라인 업로드 모달 — Portal로 document.body에 마운트해 fixed 위치 보장 */}
      {mounted && createPortal(
        <>
          {/* 사진 찍기 FAB */}
          <button
            type="button"
            onClick={() => setShowPhotoMenu(v => !v)}
            className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3.5 rounded-full bg-green-500 text-white shadow-xl hover:bg-green-400 transition-all active:scale-90"
            aria-label="사진 찍기"
          >
            <span className="text-xl inline-block align-middle">➕</span>
            <span className="text-xl inline-block align-middle">📷</span>
            <span className="text-sm font-black inline-block align-middle">사진 찍기</span>
          </button>
          {showPhotoMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowPhotoMenu(false)}
                aria-hidden="true"
              />
              <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-2 animate-fade-in-up">
                <button
                  type="button"
                  onClick={() => { setShowPhotoMenu(false); receiptInputRef.current?.click() }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-lg whitespace-nowrap"
                >
                  <span className="text-xl">🧾</span> 영수증 찍기
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPhotoMenu(false); activityInputRef.current?.click() }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-600 text-white font-black text-sm shadow-lg whitespace-nowrap"
                >
                  <span className="text-xl">🖼️</span> 활동사진 찍기
                </button>
              </div>
            </>
          )}

          {/* 인라인 업로드 모달 — 화면 중앙 */}
          {uploadMode && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={closeUploadSheet}
                aria-hidden="true"
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[500px] max-h-[90dvh] overflow-y-auto animate-fade-in-up">
                  <div className="px-5 pb-8 pt-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-black text-zinc-900">
                        {uploadMode === 'receipt' ? '🧾 영수증 기록하기' : '📸 활동 기록'}
                      </h2>
                      <button onClick={closeUploadSheet} className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-base font-black transition-colors">✕</button>
                    </div>

                    {/* 사진 미리보기 */}
                    {uploadPreview && (
                      <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 ring-1 ring-zinc-200">
                        <img src={uploadPreview} alt="미리보기" className="w-full h-full object-cover" />
                        {uploadAnalyzing && (
                          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mb-2" />
                            <p className="font-black text-sm animate-pulse-gentle">영수증 읽는 중...</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 두 번째 사진 추가 */}
                    <div className="mb-4">
                      {secondPreview ? (
                        <div className="relative aspect-square rounded-2xl overflow-hidden ring-1 ring-zinc-200">
                          <img src={secondPreview} alt="추가 사진" className="w-full h-full object-cover" />
                          <button
                            onClick={() => { setSecondFile(null); setSecondPreview(null) }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
                          >✕</button>
                          <span className="absolute bottom-2 left-2 text-[10px] font-black text-white bg-black/40 px-2 py-0.5 rounded-full">
                            {uploadMode === 'receipt' ? '활동사진' : '영수증'}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => secondFileRef.current?.click()}
                          className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-400 text-sm font-bold hover:border-zinc-400 hover:text-zinc-600 transition-all flex items-center justify-center gap-2"
                        >
                          <span>{uploadMode === 'receipt' ? '📸' : '🧾'}</span>
                          <span>{uploadMode === 'receipt' ? '활동사진도 추가하기 (선택)' : '영수증도 추가하기 (선택)'}</span>
                        </button>
                      )}
                      <input ref={secondFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSecondFile} />
                    </div>

                    {/* 활동 내용 */}
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                        placeholder={uploadAnalyzing ? '사진 읽는 중...' : '무엇을 했나요? 편의점 간식처럼 적어 주세요'}
                        className="w-full p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-bold transition-all"
                        required
                      />
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          step={1000}
                          value={uploadAmount}
                          onChange={(e) => setUploadAmount(e.target.value)}
                          placeholder="0"
                          className="w-full p-4 pr-12 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-xl font-black text-right transition-all"
                          required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">원</span>
                      </div>
                      <input
                        type="date"
                        value={uploadDate}
                        onChange={(e) => setUploadDate(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-bold transition-all"
                      />
                    </div>

                    {uploadToast && (
                      <div className={`mt-3 p-3 rounded-xl text-sm font-bold animate-fade-in-up ${uploadToast.includes('안') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {uploadToast}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={uploadSubmitting || uploadAnalyzing || !uploadDescription || !uploadAmount}
                      onClick={handleInlineSubmit}
                      className="w-full mt-4 py-4 rounded-2xl bg-green-600 text-white font-black text-base active:scale-[0.98] transition-all disabled:bg-zinc-300"
                    >
                      {uploadSubmitting ? '기록하는 중...' : uploadAnalyzing ? '사진 읽는 중...' : '활동 기록하기'}
                    </button>

                    <p className="text-center text-zinc-400 text-xs font-medium mt-2">
                      지원자 선생님이 확인하면 예산에 반영해요.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </>,
        document.body
      )}

    </section>
  )
}
