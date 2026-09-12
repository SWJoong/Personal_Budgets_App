import Link from 'next/link'
import { requireAdmin } from '@/utils/supabase/staff'
import { getAllUsers } from '@/app/actions/admin'
import type { UserRole } from '@/types/database'
import UserRoleManagementClient from './UserRoleManagementClient'

export const metadata = { title: '역할 관리' }

/**
 * 관리자 역할 관리 라우트 — 고아 액션 getAllUsers 배선점(직접 쿼리 대신 액션 호출).
 * 설계: Plan&Source/goala_admin_role_management_W.md §1. 헤더는 당사자 수정(edit/page.tsx) 미러.
 */
export default async function AdminUsersPage() {
  const { user } = await requireAdmin()

  const result = await getAllUsers()
  const users = (result.profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? null,
    email: p.email ?? null,
    role: p.role as UserRole,
    created_at: p.created_at,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/admin"
          aria-label="뒤로 가기"
          className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="text-xl font-bold tracking-tight">역할 관리</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6">
        <UserRoleManagementClient users={users} currentUserId={user.id} />
      </main>
    </div>
  )
}
