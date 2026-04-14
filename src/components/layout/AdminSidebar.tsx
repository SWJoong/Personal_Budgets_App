"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface AdminSidebarProps {
  /** 데스크톱에서 접힌 상태 (아이콘만 표시) */
  collapsed?: boolean
  /** 접기/펼치기 토글 콜백 */
  onToggle?: () => void
}

const menuItems = [
  { name: '관리자 대시보드', href: '/admin',                  icon: '📊' },
  { name: '당사자 관리',     href: '/admin/participants',      icon: '👥' },
  { name: '영수증 검토 대기', href: '/supporter/review',       icon: '🧾' },
  { name: '회계/거래장부',   href: '/supporter/transactions',  icon: '📒' },
  { name: '증빙/서류 보관함', href: '/supporter/documents',    icon: '📁' },
  { name: '계획과 평가',     href: '/supporter/evaluations',   icon: '📋' },
  { name: '시스템 설정',     href: '/admin/settings',          icon: '⚙️' },
]

export function AdminSidebar({ collapsed = false, onToggle }: AdminSidebarProps) {
  const pathname = usePathname()
  const { user, supabase } = useAuth()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="h-full w-full bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300 flex flex-col pb-4 shadow-2xl overflow-y-auto overflow-x-hidden">
      {/* 헤더 영역 */}
      <div className={`flex items-center h-14 shrink-0 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!collapsed && (
          <Link href="/admin" className="block hover:opacity-80 transition-opacity min-w-0 flex-1 mr-2">
            <h2 className="text-white font-bold text-base tracking-tight leading-tight truncate">아름드리꿈터</h2>
            <span className="text-slate-400 text-xs font-normal">관리자 뷰 (회계장부)</span>
          </Link>
        )}
        {/* 접기/펼치기 버튼 — 데스크톱 전용 (onToggle 있을 때만 표시) */}
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

      {/* 구분선 */}
      <div className="h-px bg-white/10 mx-3 mb-3 shrink-0" />

      {/* 메뉴 */}
      <nav className="flex-1 px-2 space-y-0.5">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/supporter' && item.href !== '/admin' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`flex items-center gap-3 rounded-xl transition-all duration-150 ${
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-white/10 text-white font-semibold shadow-sm'
                  : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`text-xl shrink-0 transition-transform ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  <span className="text-sm truncate">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-gentle shrink-0" />
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

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
