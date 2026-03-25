'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/database'

const ADMIN_EMAIL = 'cheese0318@nowondaycare.org'

/**
 * 관리자 권한 검증
 */
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다.')
  }

  return { user, supabase }
}

/**
 * 사용자 역할 변경
 */
export async function updateUserRole(userId: string, newRole: UserRole) {
  const { user, supabase } = await verifyAdmin()

  // 자기 자신의 역할 변경 방지
  if (userId === user.id) {
    return { error: '자신의 역할은 변경할 수 없습니다.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) {
    return { error: `역할 변경 실패: ${error.message}` }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}

/**
 * 관리자 계정 초기 설정 (cheese0318@nowondaycare.org)
 * 해당 이메일 사용자가 profiles에 존재하면 admin 역할 부여
 */
export async function ensureAdminAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return

  // 현재 로그인 유저의 이메일이 관리자 이메일인 경우 자동 승격
  if (user.email === ADMIN_EMAIL) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile && profile.role !== 'admin') {
      await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id)
    }
  }
}

/**
 * 전체 사용자 목록 조회 (관리자 전용)
 */
export async function getAllUsers() {
  const { supabase } = await verifyAdmin()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message, profiles: [] }
  }

  return { profiles: profiles || [] }
}
