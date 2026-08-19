'use client'

import { useState, useEffect } from 'react'

const PREFIX = 'help_visited_'

export function useFirstVisit(sectionKey: string): [boolean, () => void] {
  const [isFirstVisit, setIsFirstVisit] = useState(false)

  useEffect(() => {
    try {
      const visited = localStorage.getItem(PREFIX + sectionKey)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe: localStorage 첫 방문 여부를 마운트 후 동기화
      if (!visited) setIsFirstVisit(true)
    } catch {}
  }, [sectionKey])

  const markVisited = () => {
    try {
      localStorage.setItem(PREFIX + sectionKey, 'true')
    } catch {}
    setIsFirstVisit(false)
  }

  return [isFirstVisit, markVisited]
}
