'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import NavigationProgress from '@/components/layout/NavigationProgress'

export function SupporterLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // 페이지 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationProgress />

      {/* Desktop sidebar — fixed wrapper, AdminSidebar fills it */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 z-40 print:hidden" data-print-hide>
        <AdminSidebar />
      </div>

      {/* Mobile: top header with hamburger */}
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

      {/* Mobile: backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[60] print:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
          data-print-hide
        />
      )}

      {/* Mobile: slide-in sidebar drawer */}
      <div
        className={`md:hidden fixed left-0 top-0 bottom-0 w-72 z-[70] transition-transform duration-300 ease-in-out print:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-print-hide
      >
        {/* Close button row inside drawer */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="메뉴 닫기"
          >
            <span className="text-lg leading-none">✕</span>
          </button>
        </div>
        <AdminSidebar />
      </div>

      <main className="flex-1 w-full md:ml-64 print:ml-0 relative min-h-screen pt-14 md:pt-0 print:pt-0">
        {children}
      </main>
    </div>
  )
}
