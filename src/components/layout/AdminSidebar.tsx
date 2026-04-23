"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface AdminSidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

interface SubItem {
  name: string
  href: string
}

interface MenuItem {
  name: string
  href: string
  icon: string
  sub?: SubItem[]
}

const menuItems: MenuItem[] = [
  { name: '관리자 대시보드', href: '/admin', icon: '📊' },
  {
    name: '당사자 관리',
    href: '/admin/participants',
    icon: '👥',
    sub: [
      { name: '➕ 당사자 등록',    href: '/admin/participants/new' },
      { name: '📋 전체 목록',      href: '/admin/participants' },
      { name: '📊 통합 현황',      href: '/supporter/participants' },
    ],
  },
  { name: '영수증 검토 대기', href: '/supporter/review',       icon: '🧾' },
  { name: '회계/거래장부',    href: '/supporter/transactions', icon: '📒' },
  { name: '증빙/서류 보관함', href: '/supporter/documents',    icon: '📁' },
  { name: '계획과 평가',      href: '/supporter/evaluations',  icon: '📋' },
  { name: '활동 지도',        href: '/supporter/map',          icon: '🗺️' },
  { name: '시스템 설정',      href: '/admin/settings',         icon: '⚙️' },
]

const quickItems: SubItem[] = [
  { name: '➕ 당사자 등록',    href: '/admin/participants/new' },
  { name: '🧾 영수증 검토',    href: '/supporter/review' },
  { name: '📊 예산 배정',      href: '/admin/participants' },
  { name: '📋 평가 작성',      href: '/supporter/evaluations' },
  { name: '😊 피드백 확인',    href: '/admin/feedback' },
]

export function AdminSidebar({ collapsed = false, onToggle }: AdminSidebarProps) {
  const pathname = usePathname()
  const { user, supabase } = useAuth()
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({})
  const [quickOpen, setQuickOpen] = useState(false)

  const toggleSub = (href: string) =>
    setOpenSubs(prev => ({ ...prev, [href]: !prev[href] }))

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="h-full w-full bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300 flex flex-col pb-4 shadow-2xl overflow-y-auto overflow-x-hidden">
      {/* 헤더 */}
      <div className={`flex items-center h-14 shrink-0 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!collapsed && (
          <Link href="/admin" className="block hover:opacity-80 transition-opacity min-w-0 flex-1 mr-2">
            <h2 className="text-white font-bold text-base tracking-tight leading-tight truncate">아름드리꿈터</h2>
            <span className="text-slate-400 text-xs font-normal">관리자 뷰 (회계장부)</span>
          </Link>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-all"
          >
            <span className="text-sm">{collapsed ? '▶' : '◀'}</span>
          </button>
        )}
      </div>

      <div className="h-px bg-white/10 mx-3 mb-3 shrink-0" />

      {/* 메인 메뉴 */}
      <nav className="flex-1 px-2 space-y-0.5">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/supporter' && item.href !== '/admin' && pathname.startsWith(item.href))
          const hasSub = !collapsed && item.sub && item.sub.length > 0
          const isSubOpen = openSubs[item.href] ?? isActive

          return (
            <div key={item.name}>
              <div className="flex items-center">
                <Link
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={`flex items-center gap-3 rounded-xl transition-all duration-150 flex-1 ${
                    collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                  } ${isActive ? 'bg-white/10 text-white font-semibold shadow-sm' : 'hover:bg-white/5 hover:text-white'}`}
                >
                  <span className={`text-xl shrink-0 transition-transform ${isActive ? 'scale-110' : ''}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="text-sm truncate flex-1">{item.name}</span>
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-gentle shrink-0" />
                      )}
                    </>
                  )}
                </Link>
                {/* 서브메뉴 토글 버튼 */}
                {hasSub && (
                  <button
                    onClick={() => toggleSub(item.href)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all shrink-0 mr-1"
                    aria-label={isSubOpen ? '접기' : '펼치기'}
                  >
                    <span className="text-xs">{isSubOpen ? '▲' : '▼'}</span>
                  </button>
                )}
              </div>

              {/* 서브메뉴 */}
              {hasSub && isSubOpen && (
                <div className="ml-8 mt-0.5 flex flex-col gap-0.5">
                  {item.sub!.map(sub => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`text-xs px-3 py-2 rounded-lg transition-all ${
                        pathname === sub.href
                          ? 'bg-white/10 text-white font-bold'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* 빠른 설정 섹션 */}
      {!collapsed && (
        <div className="px-2 mt-3 shrink-0">
          <div className="h-px bg-white/10 mb-3" />
          <button
            onClick={() => setQuickOpen(p => !p)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <span className="text-base">⚡</span>
            <span className="flex-1 text-left font-bold">빠른 설정</span>
            <span className="text-xs">{quickOpen ? '▲' : '▼'}</span>
          </button>
          {quickOpen && (
            <div className="mt-1 flex flex-col gap-0.5">
              {quickItems.map(q => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="text-xs px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-all"
                >
                  {q.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 사용자 정보 + 로그아웃 */}
      <div className="px-2 mt-3 space-y-1 shrink-0">
        {!collapsed && user && (
          <div className="px-3 py-2 rounded-xl bg-white/5">
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? '로그아웃' : undefined}
          className={`flex items-center gap-3 w-full rounded-xl text-left text-sm hover:bg-white/5 transition-all text-slate-400 hover:text-white py-2.5 ${
            collapsed ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <span className="text-xl shrink-0">🚪</span>
          {!collapsed && <span>로그아웃</span>}
        </button>
      </div>
    </aside>
  )
}
