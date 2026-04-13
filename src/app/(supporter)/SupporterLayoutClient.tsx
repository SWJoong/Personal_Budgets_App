'use client'

import { useState } from 'react'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import NavigationProgress from '@/components/layout/NavigationProgress'

export function SupporterLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationProgress />
      {/* Desktop sidebar */}
      <div className="hidden md:block print:hidden" data-print-hide>
        <AdminSidebar />
      </div>

      {/* Mobile header with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-slate-900 text-white border-b border-slate-700 print:hidden" data-print-hide>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="메뉴 열기"
          aria-expanded={mobileMenuOpen}
        >
          <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
        </button>
        <h1 className="text-sm font-bold">아름드리꿈터 관리</h1>
        <div className="w-[44px]" />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 print:hidden"
            onClick={() => setMobileMenuOpen(false)}
            data-print-hide
          />
          <div className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 animate-in slide-in-from-left duration-200 print:hidden" data-print-hide>
            <AdminSidebar />
          </div>
        </>
      )}

      <main className="flex-1 w-full md:ml-64 print:ml-0 relative min-h-screen pt-14 md:pt-0 print:pt-0">
        {children}
      </main>
    </div>
  )
}
