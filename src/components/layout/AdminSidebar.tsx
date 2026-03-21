"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, supabase } = useAuth()

  // 임시 로그아웃 핸들러 
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
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-900 text-zinc-300 flex flex-col pt-6 pb-4">
      <div className="px-6 mb-8 text-white font-bold text-lg tracking-tight leading-tight">
        아름드리꿈터 <br/>
        <span className="text-zinc-400 text-sm font-normal">관리자 뷰 (회계장부)</span>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/supporter' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive ? 'bg-zinc-800 text-white font-semibold' : 'hover:bg-zinc-800/50 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-4 mt-auto">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-left text-sm hover:bg-zinc-800 transition-colors"
        >
          <span className="text-xl">🚪</span>
          로그아웃
        </button>
      </div>
    </aside>  
  )
}
