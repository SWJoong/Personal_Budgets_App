'use client'

import { useState } from 'react'
import { formatCurrency } from '@/utils/budget-visuals'
import ImageLightbox from '@/components/ui/ImageLightbox'

interface MonthlyPlanEasyCardProps {
  id: string
  orderIndex: number
  title: string
  easyDescription: string | null
  easyImageUrl: string | null    // signed URL (서버에서 미리 생성)
  targetCount: number | null
  txCount: number
  plannedBudget: number
  spentConfirmed: number
  spentPending: number
}

// order_index 기반 이모지 + 배경색 fallback
const FALLBACK_STYLES: { emoji: string; bg: string }[] = [
  { emoji: '🎯', bg: 'bg-blue-100' },
  { emoji: '🎨', bg: 'bg-green-100' },
  { emoji: '🏃', bg: 'bg-amber-100' },
  { emoji: '🍽️', bg: 'bg-purple-100' },
  { emoji: '🛒', bg: 'bg-rose-100' },
  { emoji: '🎵', bg: 'bg-teal-100' },
]

function ProgressIcons({ done, total }: { done: number; total: number }) {
  return (
    <div
      className="flex flex-wrap gap-1 justify-center mt-1"
      role="img"
      aria-label={`${total}번 중 ${done}번 했어요`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="text-xl leading-none" aria-hidden="true">
          {i < done ? '🟢' : '⭕'}
        </span>
      ))}
    </div>
  )
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(1, done / total) : 0
  const color =
    pct >= 0.8 ? 'bg-emerald-400' :
    pct >= 0.5 ? 'bg-amber-400' :
    'bg-red-400'
  return (
    <div className="w-full mt-1" aria-label={`${total}번 중 ${done}번 했어요`}>
      <div className="h-2.5 rounded-full bg-zinc-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct * 100}%` }}
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
    </div>
  )
}

export default function MonthlyPlanEasyCard({
  orderIndex,
  title,
  easyDescription,
  easyImageUrl,
  targetCount,
  txCount,
  plannedBudget,
  spentConfirmed,
  spentPending,
}: MonthlyPlanEasyCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const fallback = FALLBACK_STYLES[(orderIndex - 1) % FALLBACK_STYLES.length]
  const displayText = easyDescription || title
  const remaining = Math.max(0, plannedBudget - spentConfirmed)
  const budgetPct = plannedBudget > 0 ? Math.min(100, Math.round((spentConfirmed / plannedBudget) * 100)) : 0

  return (
    <>
      <div className="flex flex-col items-center gap-2 bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm p-4 min-w-[170px] max-w-[210px]">
        {/* 이미지 또는 이모지 fallback */}
        {easyImageUrl ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="w-28 h-28 rounded-xl overflow-hidden shrink-0 cursor-zoom-in active:scale-95 transition-transform"
            aria-label={`${displayText} 사진 크게 보기`}
          >
            <img
              src={easyImageUrl}
              alt={displayText}
              className="w-full h-full object-cover"
              width={112}
              height={112}
            />
          </button>
        ) : (
          <div
            className={`w-28 h-28 rounded-xl flex items-center justify-center text-5xl ${fallback.bg}`}
            aria-label={displayText}
          >
            <span role="img" aria-hidden="true">{fallback.emoji}</span>
          </div>
        )}

        {/* 쉬운 설명 텍스트 */}
        <p className="text-base font-black text-zinc-900 text-center leading-snug">
          {displayText}
        </p>

        {/* 진행 현황 (횟수 기반) */}
        {targetCount != null && targetCount > 0 && (
          <div className="w-full flex flex-col items-center gap-0.5">
            {targetCount <= 6 ? (
              <ProgressIcons done={txCount} total={targetCount} />
            ) : (
              <ProgressBar done={txCount} total={targetCount} />
            )}
            <p className="text-xs font-bold text-zinc-500 mt-0.5">
              {txCount}/{targetCount}번
            </p>
          </div>
        )}

        {/* 예산 정보 */}
        {plannedBudget > 0 && (
          <div className="w-full border-t border-zinc-100 pt-2 flex flex-col gap-1">
            <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct >= 100 ? 'bg-red-400' : budgetPct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${budgetPct}%` }}
                role="progressbar"
                aria-label={`예산 사용 ${budgetPct}%`}
                aria-valuenow={budgetPct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-zinc-400 font-bold">남은 돈</span>
              <span className={`text-xs font-black ${remaining === 0 ? 'text-red-500' : 'text-zinc-800'}`}>
                {formatCurrency(remaining)}원
              </span>
            </div>
            {spentPending > 0 && (
              <p className="text-[10px] text-orange-500 font-bold text-center">
                대기 {formatCurrency(spentPending)}원 포함 예정
              </p>
            )}
          </div>
        )}
      </div>

      {lightboxOpen && easyImageUrl && (
        <ImageLightbox
          src={easyImageUrl}
          alt={displayText}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
