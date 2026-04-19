'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAccessibility } from '@/hooks/useAccessibility'

const STORAGE_KEY = 'app-onboarding-done'

export default function EasyModeOnboarding() {
  const [mounted, setMounted] = useState(false)
  const [show, setShow] = useState(false)
  const { setEasyTerms } = useAccessibility()

  useEffect(() => {
    setMounted(true)
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setShow(true)
  }, [])

  const choose = (easy: boolean) => {
    setEasyTerms(easy)
    localStorage.setItem(STORAGE_KEY, 'true')
    setShow(false)
  }

  if (!mounted || !show) return null

  return createPortal(
    <div className="fixed inset-0 z-[9500] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
        {/* 상단 */}
        <div className="px-6 pt-8 pb-6 text-center">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-black text-zinc-900 mb-2">반가워요!</h2>
          <p className="text-base font-bold text-zinc-600 leading-relaxed">
            화면을 어떻게 보여드릴까요?<br />
            편한 방식으로 골라주세요.
          </p>
        </div>

        {/* 선택 버튼 */}
        <div className="px-6 pb-4 flex flex-col gap-3">
          <button
            onClick={() => choose(true)}
            className="w-full py-5 rounded-2xl bg-blue-500 text-white font-black text-lg flex flex-col items-center gap-1 active:scale-[0.98] transition-all shadow-lg shadow-blue-200"
          >
            <span className="text-2xl">🌸</span>
            <span>쉬운 말로 볼게요</span>
            <span className="text-blue-100 text-sm font-bold">어려운 말을 쉽게 바꿔줘요</span>
          </button>

          <button
            onClick={() => choose(false)}
            className="w-full py-5 rounded-2xl bg-zinc-100 text-zinc-700 font-black text-lg flex flex-col items-center gap-1 active:scale-[0.98] transition-all hover:bg-zinc-200"
          >
            <span className="text-2xl">📖</span>
            <span>그냥 볼게요</span>
            <span className="text-zinc-400 text-sm font-bold">기본 화면으로 봐요</span>
          </button>
        </div>

        {/* 안내 */}
        <div className="px-6 py-4 border-t border-zinc-100 text-center">
          <p className="text-xs text-zinc-400 leading-relaxed">
            설정은 언제든지 바꿀 수 있어요.<br />
            <span className="font-bold text-zinc-500">더보기 → 화면 설정</span>에서 변경하세요.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
