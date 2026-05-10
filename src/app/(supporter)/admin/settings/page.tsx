import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getEvalTemplateSetting } from '@/app/actions/evalTemplates'
import AdminSettingsClient from './AdminSettingsClient'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 관리자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  // 전체 사용자 목록 조회
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // 현재 평가 양식 설정
  const evalSetting = await getEvalTemplateSetting()

  return (
    <AdminSettingsClient
      currentUserId={user.id}
      currentUserEmail={user.email || ''}
      profiles={allProfiles || []}
      evalSetting={evalSetting}
    />
  )
}
