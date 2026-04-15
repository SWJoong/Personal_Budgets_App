'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { FAQ_ITEMS } from '@/data/faqContent'

function FaqModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  useEffect(() => {
    setMounted(true)
    // 모달 열릴 때 스크롤 잠금
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!mounted) return null

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="font-black text-zinc-900 text-base">Q&A · 자주 묻는 질문</h2>
            <p className="text-xs text-zinc-400 mt-0.5">실무자 피드백을 바탕으로 정리했습니다</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 목록 */}
        <div className="overflow-y-auto flex-1 divide-y divide-zinc-100">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="px-5 py-4">
              {/* 질문 */}
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full text-left flex items-start gap-3 group"
              >
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[11px] font-black flex items-center justify-center">
                  Q
                </span>
                <span className="text-sm font-bold text-zinc-800 flex-1 leading-snug group-hover:text-zinc-600 transition-colors">
                  {item.question}
                </span>
                <span className="shrink-0 text-zinc-300 text-sm mt-0.5">
                  {openIdx === i ? '▲' : '▼'}
                </span>
              </button>

              {/* 답변 */}
              {openIdx === i && (
                <div className="mt-3 ml-8 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-green-100 text-green-700 text-[11px] font-black flex items-center justify-center">
                      A
                    </span>
                    <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                      {item.answer}
                    </p>
                  </div>
                  {item.note && (
                    <div className="ml-7 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-xs text-amber-700 leading-relaxed">
                        📌 {item.note}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 하단 */}
        <div className="px-5 py-4 border-t border-zinc-100 shrink-0 bg-zinc-50">
          <p className="text-xs text-zinc-400 text-center leading-relaxed">
            궁금한 점이나 불편한 점은 담당 선생님께 말씀해 주세요.
          </p>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

interface Props {
  /** 당사자 화면: 하단 탭바 위에 위치, 관리자 화면: 하단 우측 고정 */
  variant?: 'participant' | 'admin'
}

export default function FaqButton({ variant = 'participant' }: Props) {
  const [open, setOpen] = useState(false)

  if (FAQ_ITEMS.length === 0) return null

  const positionClass = variant === 'participant'
    ? 'fixed bottom-20 right-4 z-[100]'   // TabBar 높이(64px) 위
    : 'fixed bottom-6 right-6 z-[100]'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${positionClass} flex items-center gap-1.5 px-3 py-2 rounded-full bg-white shadow-lg ring-1 ring-zinc-200 hover:ring-blue-300 hover:shadow-blue-100 transition-all active:scale-95 text-zinc-600 hover:text-blue-600 group`}
        aria-label="자주 묻는 질문"
        title="Q&A 보기"
      >
        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[11px] font-black flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          Q
        </span>
        <span className="text-xs font-bold whitespace-nowrap">피드백</span>
      </button>

      {open && <FaqModal onClose={() => setOpen(false)} />}
    </>
  )
}
