import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileEditClient from './ProfileEditClient'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/')

  const ADMIN_EMAILS = ['swjoong@nowondaycare.org']
  const isAdminEmail = ADMIN_EMAILS.includes(user.email || '')

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground pb-24">
      <header className="flex h-16 items-center gap-3 px-6 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/more" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="뒤로 가기">←</Link>
        <h1 className="text-xl font-bold tracking-tight">프로필 수정</h1>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full">
        <ProfileEditClient
          profile={profile}
          userEmail={user.email || ''}
          isAdminEmail={isAdminEmail}
        />
      </main>
    </div>
  )
}
