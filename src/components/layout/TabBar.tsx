"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import type { UserRole } from '@/types/database'
import { VIEW_AS_ID_COOKIE } from '@/utils/viewAsCookies'

export function TabBar() {
  const pathname = usePathname()
  const { user, supabase } = useAuth()
  const [role, setRole] = useState<UserRole>('participant')

  // 관리자 둘러보기(view-as) 중이면 실제 역할(admin)과 무관하게 당사자 탭을 보여준다 —
  // 지금 보고 있는 화면이 당사자 화면이므로 하단 내비도 그에 맞춰야 일관적이다.
  const [viewAs, setViewAs] = useState(false)
  useEffect(() => {
    const cookie = typeof document !== 'undefined' ? document.cookie : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 클라 전용 쿠키를 마운트 후 읽어 동기화(SSR-safe)
    setViewAs(new RegExp('(?:^|; )' + VIEW_AS_ID_COOKIE + '=').test(cookie))
  }, [])

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
  // soon: true 인 탭은 아직 서울형 데이터로 다시 만들지 않아 ComingSoon 화면으로 이어진다.
  type Tab = { name: string; href: string; icon: string; soon?: boolean }
  // 4탭 확정(2026-09-04) — 영수증 탭 없음('/receipt' 는 FAB 단독 소유, 목적지 중복 제거). 갤러리는 '/more' 안.
  const participantTabs: Tab[] = [
    { name: '홈', href: '/', icon: '🏠' },
    { name: '달력', href: '/calendar', icon: '📅' },
    { name: '계획', href: '/plan', icon: '📋' },
    { name: '더보기', href: '/more', icon: '⚙' },
  ]

  const supporterTabs: Tab[] = [
    { name: '당사자', href: '/supporter', icon: '👥' },
    { name: '확인 필요', href: '/supporter/review', icon: '🧾' },
    { name: '내역 관리', href: '/supporter/transactions', icon: '📊' },
    { name: '더보기', href: '/more', icon: '⚙' },
  ]

  const adminTabs: Tab[] = [
    { name: '당사자 관리', href: '/admin/participants', icon: '👥' },
    { name: '확인 필요', href: '/supporter/review', icon: '🧾' },
    { name: '내역 관리', href: '/supporter/transactions', icon: '📊' },
    { name: '더보기', href: '/more', icon: '⚙' },
  ]

  const tabs = viewAs ? participantTabs
    : role === 'admin' ? adminTabs
    : role === 'supporter' ? supporterTabs
    : participantTabs

  return (
    <nav aria-label="메인 네비게이션" className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-safe">
      <div className="flex h-16 items-center justify-around px-2 pb-2 pt-2 sm:h-20 sm:pb-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || 
            (tab.href !== '/' && pathname.startsWith(tab.href))
          return (
             <Link
              key={tab.name}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span aria-hidden="true" className={`text-xl sm:text-2xl transition-transform ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
              <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>{tab.name}</span>
              {tab.soon && (
                <span className="absolute top-0 right-0.5 text-[8px] font-black px-1 rounded-full bg-warning-bg text-warning-fg ring-1 ring-warning">
                  준비중
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
