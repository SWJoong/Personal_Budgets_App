'use client'

import { useState, useEffect } from 'react'

const PREFIX = 'help_visited_'

export function useFirstVisit(sectionKey: string): [boolean, () => void] {
  const [isFirstVisit, setIsFirstVisit] = useState(false)

  useEffect(() => {
    try {
      const visited = localStorage.getItem(PREFIX + sectionKey)
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
