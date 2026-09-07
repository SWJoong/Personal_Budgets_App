import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileEditClient from './ProfileEditClient'
import NavDropdown from '@/components/layout/NavDropdown'
import { resolveViewAs } from '@/utils/supabase/viewAs'

export const metadata = { title: '내 정보' }

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 관리자 둘러보기(view-as)에서는 '내 프로필 수정'이 관리자 자신의 계정 편집이 되어 버린다
  // (대상 당사자의 profiles 를 대리 편집하는 것도 부적절). 저장은 어차피 차단되므로, 미리보기
  // 중에는 이 화면을 렌더하지 않고 홈으로 돌려보내 정합성을 지킨다.
  const viewAs = await resolveViewAs()
  if (viewAs.active) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/')

  const ADMIN_EMAILS = ['swjoong@nowondaycare.org']
  const isAdminEmail = ADMIN_EMAILS.includes(user.email || '')

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-10">
      <header className="flex h-16 items-center justify-between px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/more" className="text-muted-foreground hover:text-foreground transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="뒤로 가기">←</Link>
          <h1 className="text-xl font-bold tracking-tight">프로필 수정</h1>
        </div>
        <NavDropdown />
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 max-w-lg mx-auto w-full">
        <ProfileEditClient
          profile={profile}
          userEmail={user.email || ''}
          isAdminEmail={isAdminEmail}
        />
      </main>
    </div>
  )
}
