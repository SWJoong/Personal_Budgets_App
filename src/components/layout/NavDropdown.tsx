'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  icon: string
  label: string
  subs?: { href: string; icon: string; label: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/',         icon: '🏠', label: '홈' },
  { href: '/receipt',  icon: '🧾', label: '영수증' },
  { href: '/calendar', icon: '📅', label: '달력' },
  { href: '/plan',     icon: '🤔', label: '나의 계획' },
  { href: '/gallery',  icon: '📸', label: '사진 모아보기' },
  { href: '/map',      icon: '🗺️', label: '사용 장소 지도' },
  {
    href: '/more',
    icon: '⚙️',
    label: '더보기',
    subs: [
      { href: '/my-plan',              icon: '🎯', label: '내 목표 보기' },
      { href: '/evaluations',          icon: '💌', label: '지원자 선생님의 편지' },
      { href: '/more?open=display',    icon: '🌗', label: '화면 설정' },
      { href: '/more?open=files',      icon: '📁', label: '내 서류함' },
    ],
  },
]

export default function NavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMounted(true) }, [])

  // 페이지 이동 시 자동 닫기
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // 열린 동안 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const drawer = mounted && isOpen ? createPortal(
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: 99998 }}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* 우측 슬라이드 드로어 */}
      <div
        className="fixed top-0 right-0 bottom-0 w-64 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        style={{ zIndex: 99999 }}
        role="dialog"
        aria-label="페이지 이동 메뉴"
      >
        {/* 드로어 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <span className="text-sm font-black text-zinc-400 uppercase tracking-widest">메뉴</span>
          <button
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-colors"
            aria-label="메뉴 닫기"
          >
            <span className="text-zinc-600 text-sm font-black leading-none">✕</span>
          </button>
        </div>

        {/* 메뉴 목록 */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors ${
                    isActive ? 'bg-zinc-50' : ''
                  }`}
                >
                  <span className="text-2xl w-8 text-center">{item.icon}</span>
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

                {/* 서브 항목 (더보기 하위) */}
                {item.subs && (
                  <div className="flex flex-col pb-1">
                    {item.subs.map((sub) => {
                      const subBase = sub.href.split('?')[0]
                      const isSubActive = pathname === subBase
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-2.5 pl-14 pr-5 py-2.5 hover:bg-zinc-50 transition-colors ${
                            isSubActive ? 'bg-zinc-50' : ''
                          }`}
                        >
                          <span className="text-base w-5 text-center shrink-0">{sub.icon}</span>
                          <span
                            className={`text-xs font-bold flex-1 ${
                              isSubActive ? 'text-zinc-900' : 'text-zinc-500'
                            }`}
                          >
                            {sub.label}
                          </span>
                          {isSubActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-all active:scale-95"
        aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="text-zinc-600 text-base font-black leading-none select-none">
          {isOpen ? '✕' : '☰'}
        </span>
      </button>

      {drawer}
    </>
  )
}
