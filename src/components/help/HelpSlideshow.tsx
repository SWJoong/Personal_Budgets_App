'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { HelpSection } from '@/data/helpSlides'

interface Props {
  section: HelpSection
  onClose: () => void
}

export default function HelpSlideshow({ section, onClose }: Props) {
  const [current, setCurrent] = useState(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const slide = section.slides[current]
  const total = section.slides.length
  const isLast = current === total - 1

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
            {section.title}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-lg font-bold transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 진행 점 */}
        <div className="flex justify-center gap-1.5 py-2">
          {section.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${
                i === current ? 'w-5 h-2 bg-blue-500' : 'w-2 h-2 bg-zinc-200'
              }`}
              aria-label={`슬라이드 ${i + 1}`}
            />
          ))}
        </div>

        {/* 슬라이드 콘텐츠 */}
        <div className="px-6 pb-2 flex flex-col items-center gap-4 min-h-[200px] justify-center text-center">
          <span className="text-6xl">{slide.icon}</span>
          <h3 className="text-xl font-black text-zinc-900">{slide.title}</h3>
          <p className="text-sm text-zinc-600 leading-relaxed">{slide.body}</p>
        </div>

        {/* 슬라이드 번호 */}
        <p className="text-center text-xs text-zinc-300 font-bold pb-1">
          {current + 1} / {total}
        </p>

        {/* 하단 버튼 */}
        <div className="flex gap-3 px-6 pb-6 pt-2">
          {current > 0 ? (
            <button
              onClick={() => setCurrent(c => c - 1)}
              className="flex-1 py-3 rounded-2xl bg-zinc-100 text-zinc-600 font-bold text-sm hover:bg-zinc-200 transition-colors"
            >
              ← 이전
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-zinc-100 text-zinc-400 font-bold text-sm hover:bg-zinc-200 transition-colors"
            >
              건너뛰기
            </button>
          )}
          {isLast ? (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              시작하기 ✓
            </button>
          ) : (
            <button
              onClick={() => setCurrent(c => c + 1)}
              className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              다음 →
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
