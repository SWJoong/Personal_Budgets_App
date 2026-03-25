"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, supabase } = useAuth()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const menuItems = [
    { name: '통합 대시보드', href: '/supporter', icon: '📊' },
    { name: '당사자 관리', href: '/admin/participants', icon: '👥' },
    { name: '회계/거래장부', href: '/supporter/transactions', icon: '📒' },
    { name: '증빙/서류 보관함', href: '/supporter/documents', icon: '📁' },
    { name: '평가 관리', href: '/supporter/evaluations', icon: '📝' },
    { name: '시스템 설정', href: '/admin/settings', icon: '⚙️' },
  ]

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300 flex flex-col pt-6 pb-4 shadow-2xl z-40">
      <div className="px-6 mb-8">
        <h2 className="text-white font-bold text-lg tracking-tight leading-tight">
          아름드리꿈터
        </h2>
        <span className="text-slate-400 text-sm font-normal">관리자 뷰 (회계장부)</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/supporter' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-white/10 text-white font-semibold shadow-sm backdrop-blur-sm' 
                  : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
              <span className="text-sm">{item.name}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-gentle" />}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="px-4 mx-3 mb-2 py-3 rounded-xl bg-white/5 backdrop-blur-sm">
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>
      )}

      <div className="px-3 mt-2">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-left text-sm hover:bg-white/5 transition-all text-slate-400 hover:text-white"
        >
          <span className="text-xl">🚪</span>
          로그아웃
        </button>
      </div>
    </aside>  
  )
}
