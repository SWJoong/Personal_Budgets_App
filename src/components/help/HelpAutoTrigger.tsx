'use client'

import { useEffect, useState } from 'react'
import { useFirstVisit } from '@/hooks/useFirstVisit'
import HelpSlideshow from './HelpSlideshow'
import { HELP_SECTIONS } from '@/data/helpSlides'

interface Props {
  sectionKey: string
}

export default function HelpAutoTrigger({ sectionKey }: Props) {
  const [isFirstVisit, markVisited] = useFirstVisit(sectionKey)
  const [open, setOpen] = useState(false)
  const section = HELP_SECTIONS[sectionKey]

  useEffect(() => {
    if (isFirstVisit) {
      // 페이지 로드 후 약간의 딜레이를 두고 열어 레이아웃이 안정된 뒤 표시
      const timer = setTimeout(() => setOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [isFirstVisit])

  if (!section || !open) return null

  return (
    <HelpSlideshow
      section={section}
      onClose={() => {
        setOpen(false)
        markVisited()
      }}
    />
  )
}
