'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

export default function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // createPortal로 document.body에 직접 렌더링 → 부모 stacking context 탈출
  return createPortal(
    <div
      className="fixed inset-0 z-[9000] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl font-bold transition-colors"
        aria-label="닫기"
      >
        ✕
      </button>
      <img
        src={src}
        alt={alt ?? '사진'}
        className="max-w-[90vw] max-h-[90dvh] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}
