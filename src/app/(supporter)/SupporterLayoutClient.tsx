'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import NavigationProgress from '@/components/layout/NavigationProgress'
import FaqButton from '@/components/feedback/FaqButton'

const STORAGE_KEY = 'admin_sidebar_collapsed'

export function SupporterLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()

  // 마지막 접기 상태 복원 (localStorage)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setSidebarCollapsed(saved === 'true')
    } catch {}
  }, [])

  // 페이지 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const next = !v
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }

  const closeMenu = () => setMobileMenuOpen(false)

  // 데스크톱 사이드바 너비
  const desktopW = sidebarCollapsed ? 'w-16' : 'w-64'
  const mainML   = sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationProgress />

      {/* 데스크톱 사이드바 — 접기/펼치기 지원 */}
      <div
        className={`hidden md:flex fixed left-0 top-0 bottom-0 z-40 transition-all duration-300 print:hidden ${desktopW}`}
        data-print-hide
      >
        <AdminSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* 모바일 상단 헤더 + 햄버거 */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-slate-900 text-white border-b border-slate-700 print:hidden"
        data-print-hide
      >
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={mobileMenuOpen}
        >
          <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
        </button>
        <h1 className="text-sm font-bold">아름드리꿈터 관리</h1>
        <div className="w-[44px]" />
      </div>

      {/* 모바일 슬라이드 오버레이 — 열렸을 때만 DOM에 존재 */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-[60] print:hidden"
            onClick={closeMenu}
            aria-hidden="true"
            data-print-hide
          />
          <div
            className="md:hidden fixed left-0 top-0 bottom-0 w-72 z-[70] animate-in slide-in-from-left duration-200 print:hidden"
            data-print-hide
          >
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={closeMenu}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="메뉴 닫기"
              >
                <span className="text-lg leading-none">✕</span>
              </button>
            </div>
            {/* 모바일 드로어는 항상 펼쳐진 상태 */}
            <AdminSidebar />
          </div>
        </>
      )}

      <main
        className={`flex-1 w-full transition-all duration-300 ${mainML} print:ml-0 relative min-h-screen pt-14 md:pt-0 print:pt-0`}
      >
        {children}
      </main>

      <FaqButton variant="admin" />
    </div>
  )
}
