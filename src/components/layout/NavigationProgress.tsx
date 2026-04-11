'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const prevPathname = useRef(pathname)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start progress bar on pathname change (navigation complete)
  // We detect navigation START via click on links using a global click handler
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return
      // Internal navigation starting
      setVisible(true)
      setWidth(15)
      let w = 15
      animRef.current = setInterval(() => {
        w = w + (85 - w) * 0.08
        if (w > 90) w = 90
        setWidth(w)
      }, 100)
    }

    window.addEventListener('click', onLinkClick, true)
    return () => window.removeEventListener('click', onLinkClick, true)
  }, [])

  // Complete progress bar when pathname changes
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      if (animRef.current) clearInterval(animRef.current)
      setWidth(100)
      timerRef.current = setTimeout(() => {
        setVisible(false)
        setWidth(0)
      }, 300)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[3px] bg-blue-500 transition-all duration-200 ease-out"
      style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
    />
  )
}
