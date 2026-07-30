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

/**
 * 서버 액션 전용 실무자 게이트. requireStaff() 와 같은 조건을 확인하지만
 * redirect() 대신 에러를 던진다 — 폼 제출 중 리다이렉트가 일어나면 사용자가
 * 놀라므로, 액션에서는 이 함수를 try/catch 로 감싸 { error } 로 돌려준다.
 */
export async function assertStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'supporter' && profile.role !== 'admin')) {
    throw new Error('담당자 권한이 필요합니다.')
  }

  return { supabase, user, profile }
}

/** 서버 액션 전용 관리자 게이트. assertStaff() 와 같은 이유로 에러를 던진다. */
export async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다.')
  }

  return { supabase, user, profile }
}
