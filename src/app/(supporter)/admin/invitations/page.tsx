import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getInvitations } from '@/app/actions/admin'
import InvitationsClient from './InvitationsClient'

export const dynamic = 'force-dynamic'

export default async function InvitationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/supporter')

  const { invitations, error } = await getInvitations()

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">사용자 초대 관리</h1>
        <p className="text-sm text-zinc-500 mt-1">
          당사자와 관리자 계정을 미리 등록해두면, 해당 이메일로 Google 로그인 시 자동으로 역할이 부여됩니다.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <InvitationsClient invitations={invitations} />
    </div>
  )
}
