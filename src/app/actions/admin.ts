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
  revalidatePath('/admin')
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

/**
 * 최초 로그인 시 admin이 없으면 자동 admin 부여 (§2)
 * PostgreSQL RPC를 사용한 원자적(atomic) 처리로 Race Condition 방지
 */
export async function assignRoleForFirstUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  try {
    // PostgreSQL 함수로 원자적 처리
    // (만약 RPC 함수가 없으면 데이터베이스 트리거 사용)
    const { error } = await supabase.rpc('assign_first_admin', { 
      user_id: user.id 
    })

    if (!error) {
      revalidatePath('/')
    }
  } catch (e) {
    // RPC 함수가 없으면 폴백: 관리자가 없으면 업데이트
    // (이 방식도 경합 조건이 있지만, DB 트리거가 최종 보호)
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')

    if (count === 0) {
      await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id)
      revalidatePath('/')
    }
  }
}

/**
 * 새 당사자 등록 (UUID 기반)
 * 구글 계정 연동 없이 독립적으로 생성
 */
export async function createParticipant(formData: {
  name: string
  email: string
  monthlyBudget: number
  yearlyBudget: number
  startDate: string
  endDate: string
  alertThreshold: number
  supporterId: string | null
  fundingSources: Array<{
    name: string
    monthlyBudget: number
    yearlyBudget: number
  }>
}) {
  const { supabase } = await verifyAdmin()
  
  // UUID 생성 (Node.js crypto)
  const crypto = await import('crypto')
  const newParticipantId = crypto.randomUUID()

  try {
    // 1. 당사자 등록
    const { error: participantError } = await supabase
      .from('participants')
      .insert({
        id: newParticipantId,
        monthly_budget_default: formData.monthlyBudget,
        yearly_budget_default: formData.yearlyBudget,
        budget_start_date: formData.startDate,
        budget_end_date: formData.endDate,
        funding_source_count: formData.fundingSources.length,
        alert_threshold: formData.alertThreshold,
        assigned_supporter_id: formData.supporterId || null,
      })

    if (participantError) {
      return { error: `당사자 등록 실패: ${participantError.message}` }
    }

    // 2. 재원 등록
    for (const fs of formData.fundingSources) {
      const { error: fsError } = await supabase
        .from('funding_sources')
        .insert({
          participant_id: newParticipantId,
          name: fs.name,
          monthly_budget: fs.monthlyBudget,
          yearly_budget: fs.yearlyBudget,
          current_month_balance: fs.monthlyBudget,
          current_year_balance: fs.yearlyBudget,
        })

      if (fsError) {
        return { error: `재원 등록 실패: ${fsError.message}` }
      }
    }

    revalidatePath('/admin/participants')
    return { success: true, participantId: newParticipantId }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}
