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

  // role 을 클라이언트 사이드바까지 내려준다 — AdminSidebar 가 자체 조회 대신 이 값으로 첫
  // 렌더부터 정확한 메뉴/라벨을 그린다(실무자 초기 flash·조회실패 admin 고착 제거, 08 QA 후속).
  return <SupporterLayoutClient role={profile.role}>{children}</SupporterLayoutClient>
}
