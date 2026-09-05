import Link from 'next/link'
import { requireAdmin } from '@/utils/supabase/staff'
import { getInvitations } from '@/app/actions/admin'
import InvitationsClient from './InvitationsClient'

export const metadata = { title: '사용자 초대' }

/**
 * 사용자 초대 (GOAL축 A, §4-4) — ComingSoon 스텁 대체. 관리자 전용(requireAdmin).
 * 목록 + 발급 폼 + 취소. 액션은 admin.ts(getInvitations·createInvitation·deleteInvitation)에 이미 존재.
 */
export default async function InvitationsPage() {
  await requireAdmin()
  const { invitations, error } = await getInvitations()

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link
          href="/admin"
          aria-label="대시보드로 가기"
          className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight">사용자 초대</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {error ? (
          <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm leading-relaxed">
            {error}
          </div>
        ) : (
          <InvitationsClient invitations={invitations} />
        )}
      </main>
    </div>
  )
}
