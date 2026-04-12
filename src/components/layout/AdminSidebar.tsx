"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect } from 'react'
import { updateUserRole } from '@/app/actions/admin'
import type { UserRole } from '@/types/database'
import type { Profile } from '@/types/database'

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, supabase } = useAuth()
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)

  useEffect(() => {
    loadUserRole()
  }, [user?.id])

  async function loadUserRole() {
    if (!user) return
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) setCurrentRole(profile.role as UserRole)
    } catch (e) {
      console.error('역할 로드 실패:', e)
    }
  }

  async function loadAllUsers() {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profiles) setAllUsers(profiles as Profile[])
    } catch (e) {
      console.error('사용자 목록 로드 실패:', e)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === user?.id) {
      alert('자신의 역할은 변경할 수 없습니다.')
      return
    }

    setIsUpdatingRole(true)
    try {
      const result = await updateUserRole(userId, newRole)
      if (result.error) {
        alert(`역할 변경 실패: ${result.error}`)
      } else {
        alert('역할이 변경되었습니다.')
        setShowRoleMenu(false)
        router.refresh()
      }
    } catch (e: any) {
      alert(`오류: ${e.message}`)
    } finally {
      setIsUpdatingRole(false)
    }
  }

  const handleShowRoleMenu = () => {
    if (!showRoleMenu) {
      loadAllUsers()
    }
    setShowRoleMenu(!showRoleMenu)
  }

  const menuItems = [
    { name: '관리자 대시보드', href: '/admin', icon: '📊' },
    { name: '당사자 관리', href: '/admin/participants', icon: '👥' },
    { name: '영수증 검토 대기', href: '/supporter/review', icon: '🧾' },
    { name: '회계/거래장부', href: '/supporter/transactions', icon: '📒' },
    { name: '증빙/서류 보관함', href: '/supporter/documents', icon: '📁' },
    { name: '계획과 평가', href: '/supporter/evaluations', icon: '📋' },
    { name: '시스템 설정', href: '/admin/settings', icon: '⚙️' },
  ]

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300 flex flex-col pt-6 pb-4 shadow-2xl z-40">
      <div className="px-6 mb-8">
        <Link href="/admin" className="block hover:opacity-80 transition-opacity">
          <h2 className="text-white font-bold text-lg tracking-tight leading-tight">
            아름드리꿈터
          </h2>
          <span className="text-slate-400 text-sm font-normal">관리자 뷰 (회계장부)</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/supporter' && item.href !== '/admin' && pathname.startsWith(item.href))
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

      {/* Role Switcher */}
      <div className="px-3 mx-3 mb-3 relative">
        <button
          onClick={handleShowRoleMenu}
          disabled={isUpdatingRole}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 transition-all text-blue-200 text-sm disabled:opacity-50"
        >
          <span>🎭</span>
          <span>역할: {currentRole || '로딩중...'}</span>
          <span className="ml-auto text-xs">{showRoleMenu ? '▼' : '▶'}</span>
        </button>

        {/* Dropdown Menu */}
        {showRoleMenu && (
          <div className="absolute bottom-full mb-2 left-3 right-3 bg-slate-700 rounded-lg shadow-xl z-50 overflow-hidden border border-slate-600">
            <div className="max-h-64 overflow-y-auto">
              {allUsers.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400">사용자 없음</div>
              ) : (
                allUsers.map((profile) => (
                  <div
                    key={profile.id}
                    className="px-3 py-2 border-b border-slate-600 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span className="text-slate-300 truncate font-medium">
                        {profile.name || profile.id.slice(0, 8)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        profile.role === 'admin' ? 'bg-red-500/30 text-red-200' :
                        profile.role === 'supporter' ? 'bg-yellow-500/30 text-yellow-200' :
                        'bg-blue-500/30 text-blue-200'
                      }`}>
                        {profile.role}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(['admin', 'supporter', 'participant'] as UserRole[]).map((role) => (
                        <button
                          key={role}
                          onClick={() => handleRoleChange(profile.id, role)}
                          disabled={isUpdatingRole || profile.role === role || profile.id === user?.id}
                          className={`text-xs px-2 py-1 rounded transition-all ${
                            profile.role === role
                              ? 'bg-white/20 text-white cursor-default'
                              : profile.id === user?.id
                              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-600 hover:bg-slate-500 text-slate-200 cursor-pointer'
                          }`}
                        >
                          {role === 'admin' ? '👨‍💼' : role === 'supporter' ? '👨‍🏫' : '👤'}
                          {' '}{role}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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
