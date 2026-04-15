'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/database'

const ADMIN_EMAILS = [
  'kim.cs@example.com',
  'ahreum217@nowondaycare.org',
  'valuesh@nowondaycare.org',
  'tpdnr9870@nowondaycare.org',
  '0305ysy@nowondaycare.org',
  'soujin1020@nowondaycare.org',
  'green4869@nowondaycare.org',
]

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
 * 관리자 계정 초기 설정 (kim.cs@example.com)
 * 해당 이메일 사용자가 profiles에 존재하면 admin 역할 부여
 */
export async function ensureAdminAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return

  // 현재 로그인 유저의 이메일이 관리자 이메일 목록에 있는 경우 자동 승격
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
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
 * 새 당사자 등록 (participants 테이블에 직접 생성)
 * participants는 profiles와 독립 — 자체 name, email 컬럼 보유
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

  try {
    // 1. 당사자 등록 (profiles 불필요 — participants 자체 인적사항 보유)
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        name: formData.name,
        email: formData.email,
        monthly_budget_default: formData.monthlyBudget,
        yearly_budget_default: formData.yearlyBudget,
        budget_start_date: formData.startDate,
        budget_end_date: formData.endDate,
        funding_source_count: formData.fundingSources.length,
        alert_threshold: formData.alertThreshold,
        assigned_supporter_id: formData.supporterId || null,
      })
      .select('id')
      .single()

    if (participantError || !participant) {
      return { error: `당사자 등록 실패: ${participantError?.message}` }
    }

    const newParticipantId = participant.id

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

/**
 * 당사자 정보 업데이트
 */
export async function updateParticipant(participantId: string, formData: {
  name?: string
  email?: string
  monthlyBudget?: number
  yearlyBudget?: number
  startDate?: string
  endDate?: string
  alertThreshold?: number
  supporterId?: string | null
}) {
  const { supabase } = await verifyAdmin()

  try {
    const updateData: any = {}
    if (formData.name !== undefined) updateData.name = formData.name
    if (formData.email !== undefined) updateData.email = formData.email
    if (formData.monthlyBudget !== undefined) updateData.monthly_budget_default = formData.monthlyBudget
    if (formData.yearlyBudget !== undefined) updateData.yearly_budget_default = formData.yearlyBudget
    if (formData.startDate !== undefined) updateData.budget_start_date = formData.startDate
    if (formData.endDate !== undefined) updateData.budget_end_date = formData.endDate
    if (formData.alertThreshold !== undefined) updateData.alert_threshold = formData.alertThreshold
    if (formData.supporterId !== undefined) updateData.assigned_supporter_id = formData.supporterId

    const { error } = await supabase
      .from('participants')
      .update(updateData)
      .eq('id', participantId)

    if (error) {
      return { error: `업데이트 실패: ${error.message}` }
    }

    revalidatePath('/admin/participants')
    revalidatePath(`/admin/participants/${participantId}`)
    revalidatePath(`/admin/participants/${participantId}/preview`)
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

/**
 * 당사자 삭제 (CASCADE로 관련 데이터도 함께 삭제됨)
 */
export async function deleteParticipant(participantId: string) {
  const { supabase } = await verifyAdmin()

  try {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId)

    if (error) {
      return { error: `삭제 실패: ${error.message}` }
    }

    revalidatePath('/admin/participants')
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

/**
 * 재원 정보 업데이트
 */
export async function updateFundingSource(fundingSourceId: string, formData: {
  name?: string
  monthlyBudget?: number
  yearlyBudget?: number
}) {
  const { supabase } = await verifyAdmin()

  try {
    const updateData: any = {}
    if (formData.name !== undefined) updateData.name = formData.name
    if (formData.monthlyBudget !== undefined) {
      updateData.monthly_budget = formData.monthlyBudget
      updateData.current_month_balance = formData.monthlyBudget
    }
    if (formData.yearlyBudget !== undefined) {
      updateData.yearly_budget = formData.yearlyBudget
      updateData.current_year_balance = formData.yearlyBudget
    }

    const { error } = await supabase
      .from('funding_sources')
      .update(updateData)
      .eq('id', fundingSourceId)

    if (error) {
      return { error: `재원 업데이트 실패: ${error.message}` }
    }

    revalidatePath('/admin/participants')
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

/**
 * 재원 추가
 */
export async function createFundingSource(participantId: string, formData: {
  name: string
  monthlyBudget: number
  yearlyBudget: number
}) {
  const { supabase } = await verifyAdmin()

  try {
    const { error } = await supabase
      .from('funding_sources')
      .insert({
        participant_id: participantId,
        name: formData.name,
        monthly_budget: formData.monthlyBudget,
        yearly_budget: formData.yearlyBudget,
        current_month_balance: formData.monthlyBudget,
        current_year_balance: formData.yearlyBudget,
      })

    if (error) {
      return { error: `재원 추가 실패: ${error.message}` }
    }

    revalidatePath('/admin/participants')
    revalidatePath(`/admin/participants/${participantId}`)
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}

/**
 * 재원 삭제
 */
export async function deleteFundingSource(fundingSourceId: string) {
  const { supabase } = await verifyAdmin()

  try {
    const { error } = await supabase
      .from('funding_sources')
      .delete()
      .eq('id', fundingSourceId)

    if (error) {
      return { error: `재원 삭제 실패: ${error.message}` }
    }

    revalidatePath('/admin/participants')
    return { success: true }
  } catch (e: any) {
    return { error: `오류: ${e.message}` }
  }
}
