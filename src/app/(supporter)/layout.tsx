import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { SupporterLayoutClient } from './SupporterLayoutClient'

export const dynamic = 'force-dynamic'

export default async function SupporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 허용 목록으로 바꾼다 — 예전에는 role==='participant' 만 걸러냈으므로
  // profiles 행이 아직 없는(트리거 미적용 등) 사용자는 그냥 통과했다.
  if (profile?.role !== 'admin' && profile?.role !== 'supporter') {
    redirect('/')
  }

  return <SupporterLayoutClient>{children}</SupporterLayoutClient>
}
