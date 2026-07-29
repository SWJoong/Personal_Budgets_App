import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

/** 실무자·관리자 전용 화면의 공통 인증 게이트. 아니면 당사자 홈으로 돌려보낸다. */
export async function requireStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    redirect('/')
  }

  return { supabase, user, profile }
}

/** 관리자 전용 화면의 공통 인증 게이트. */
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  return { supabase, user, profile }
}
