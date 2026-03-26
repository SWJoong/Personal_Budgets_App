"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import type { UserRole } from '@/types/database'

export function TabBar() {
  const pathname = usePathname()
  const { user, supabase } = useAuth()
  const [role, setRole] = useState<UserRole>('participant')

  useEffect(() => {
    if (!user) return

    async function fetchRole() {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single()

      if (profile?.role) {
        setRole(profile.role as UserRole)
      }
    }

    fetchRole()
  }, [user, supabase])

  // 로그인, 지원자, 관리자 페이지에서는 모바일 탭바를 숨김 (레이아웃 분리)
  if (pathname === '/login' || pathname.startsWith('/supporter') || pathname.startsWith('/admin')) {
    return null
  }

  // 역할별 탭 구성
  const participantTabs = [
    { name: '홈', href: '/', icon: '🏠' },
    { name: '오늘 계획', href: '/plan', icon: '📝' },
    { name: '영수증', href: '/receipt', icon: '🧾' },
    { name: '달력', href: '/calendar', icon: '📅' },
    { name: '더보기', href: '/more', icon: '⚙' },
  ]

  const supporterTabs = [
    { name: '당사자', href: '/supporter', icon: '👥' },
    { name: '내역 관리', href: '/supporter/transactions', icon: '📊' },
    { name: '영수증 확인', href: '/receipt', icon: '🧾' },
    { name: '달력', href: '/calendar', icon: '📅' },
    { name: '더보기', href: '/more', icon: '⚙' },
  ]

  const adminTabs = [
    { name: '당사자 관리', href: '/admin/participants', icon: '👥' },
    { name: '내역 관리', href: '/supporter/transactions', icon: '📊' },
    { name: '영수증 확인', href: '/receipt', icon: '🧾' },
    { name: '달력', href: '/calendar', icon: '📅' },
    { name: '더보기', href: '/more', icon: '⚙' },
  ]

  const tabs = role === 'admin' ? adminTabs 
    : role === 'supporter' ? supporterTabs 
    : participantTabs

  return (
    <nav aria-label="메인 네비게이션" className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white pb-safe">
      <div className="flex h-16 items-center justify-around px-2 pb-2 pt-2 sm:h-20 sm:pb-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || 
            (tab.href !== '/' && pathname.startsWith(tab.href))
          return (
             <Link
              key={tab.name}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] min-w-[44px] transition-colors ${
                isActive ? 'text-primary' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <span className={`text-xl sm:text-2xl transition-transform ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
              <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
