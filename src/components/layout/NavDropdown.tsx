'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',         icon: '🏠', label: '홈' },
  { href: '/receipt',  icon: '🧾', label: '영수증' },
  { href: '/calendar', icon: '📅', label: '달력' },
  { href: '/plan',     icon: '🤔', label: '오늘 계획' },
  { href: '/more',     icon: '⚙️',  label: '더보기' },
]

export default function NavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const pathname = usePathname()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const openMenu = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setIsOpen(false)
    }
    const handleResize = () => setIsOpen(false)
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => isOpen ? setIsOpen(false) : openMenu()}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-all active:scale-95"
        aria-label="메뉴 열기"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-zinc-600 text-base font-black leading-none select-none">
          {isOpen ? '✕' : '☰'}
        </span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="fixed w-52 bg-white rounded-2xl shadow-2xl ring-1 ring-zinc-100 overflow-hidden z-[9000] animate-fade-in-down"
          style={{ top: menuPos.top, right: menuPos.right }}
          role="listbox"
          aria-label="페이지 이동"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                role="option"
                aria-selected={isActive}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 transition-colors ${
                  isActive ? 'bg-zinc-50' : ''
                }`}
              >
                <span className="text-xl w-7 text-center">{item.icon}</span>
                <span
                  className={`text-sm font-bold flex-1 ${
                    isActive ? 'text-zinc-900' : 'text-zinc-600'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
