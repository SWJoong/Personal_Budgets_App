'use client'

import { useState } from 'react'
import HelpSlideshow from './HelpSlideshow'
import { HELP_SECTIONS } from '@/data/helpSlides'

interface Props {
  sectionKey: string
  className?: string
  text?: React.ReactNode
}

export default function HelpButton({ sectionKey, className, text }: Props) {
  const [open, setOpen] = useState(false)
  const section = HELP_SECTIONS[sectionKey]
  if (!section) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? 'w-8 h-8 rounded-full bg-muted hover:opacity-90 text-muted-foreground hover:text-foreground font-black text-sm flex items-center justify-center transition-colors'}
        aria-label="도움말"
        title="이 화면 도움말 보기"
      >
        {text ?? '?'}
      </button>
      {open && <HelpSlideshow section={section} onClose={() => setOpen(false)} />}
    </>
  )
}
