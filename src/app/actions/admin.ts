'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/database'
import { auditLog } from '@/utils/audit'

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

  const { data: before } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) {
    return { error: `역할 변경 실패: ${error.message}` }
  }

  await auditLog(supabase, 'role.change', {
    targetType: 'user',
    targetId: userId,
    metadata: { from: before?.role ?? null, to: newRole },
  })

  revalidatePath('/admin/settings')
  revalidatePath('/admin')
  return { success: true }
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
 *
 * 예산 배정은 여기서 하지 않는다 — 서울형은 신청→선정→계획→심의를 거쳐야
 * seoul_budget_allocations 가 생기므로, 등록 시점에 예산 기본값을 넣는 것은
 * 제도 흐름과 맞지 않는다(§2 서울형 온톨로지 설계 참조).
 *
 * email 은 필수다 — 당사자가 나중에 구글로 로그인하면 handle_new_user() 트리거가
 * 이 이메일과 일치하는 행을 찾아 auth_user_id 를 자동으로 채운다.
 */
export async function createParticipant(formData: {
  name: string
  email: string
  supporterId: string | null
}) {
  const { supabase } = await verifyAdmin()

  try {
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .insert({
        name: formData.name,
        email: formData.email,
        assigned_supporter_id: formData.supporterId || null,
      })
      .select('id')
      .single()

    if (participantError || !participant) {
      return { error: `당사자 등록 실패: ${participantError?.message}` }
    }

    revalidatePath('/admin/participants')
    return { success: true, participantId: participant.id }
  } catch (e) {
    return { error: `오류: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * 당사자 정보 업데이트
 *
 * 예산 관련 필드(월/연 예산·경고 기준액)는 서울형 코어에 없다 — 예산은
 * seoul_budget_allocations 로 심의를 거쳐 배정된다. 등록 정보(이름·이메일·담당자)만 다룬다.
 */
export async function updateParticipant(participantId: string, formData: {
  name?: string
  email?: string
  supporterId?: string | null
}) {
  const { supabase } = await verifyAdmin()

  try {
    const updateData: { name?: string; email?: string; assigned_supporter_id?: string | null } = {}
    if (formData.name !== undefined) updateData.name = formData.name
    if (formData.email !== undefined) updateData.email = formData.email
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
    return { success: true }
  } catch (e) {
    return { error: `오류: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * 당사자 삭제 (CASCADE로 관련 데이터도 함께 삭제됨)
 *
 * 데모 모드 삭제 차단 가드는 없앴다 — 데모 계정도 이제 실제 role='admin' 계정이라
 * 삭제 권한은 RLS(seoul_is_admin())가 그대로 결정한다.
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

    await auditLog(supabase, 'participant.delete', { targetType: 'participant', targetId: participantId })

    revalidatePath('/admin/participants')
    return { success: true }
  } catch (e) {
    return { error: `오류: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ──────────────────────────────────────────
// 사용자 초대 관리 (user_invitations 테이블)
// ──────────────────────────────────────────

export type InvitationRole = 'admin' | 'supporter' | 'participant'

export interface Invitation {
  id: string
  email: string
  role: InvitationRole
  note: string | null
  used_at: string | null
  created_at: string
}

/**
 * 초대 목록 조회
 */
export async function getInvitations(): Promise<{ invitations: Invitation[]; error?: string }> {
  const { supabase } = await verifyAdmin()
  const { data, error } = await supabase
    .from('user_invitations')
    .select('id, email, role, note, used_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, invitations: [] }
  return { invitations: (data as Invitation[]) ?? [] }
}

/**
 * 초대 등록 (이메일 + 역할)
 */
export async function createInvitation(formData: {
  email: string
  role: InvitationRole
  note?: string
}): Promise<{ success?: boolean; error?: string }> {
  const { supabase, user } = await verifyAdmin()

  const { data, error } = await supabase
    .from('user_invitations')
    .insert({
      email: formData.email.trim().toLowerCase(),
      role: formData.role,
      note: formData.note?.trim() || null,
      invited_by: user.id,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return { error: '이미 등록된 이메일입니다.' }
    return { error: `등록 실패: ${error.message}` }
  }

  await auditLog(supabase, 'invitation.create', {
    targetType: 'invitation',
    targetId: data?.id ?? null,
    metadata: { role: formData.role },
  })

  revalidatePath('/admin/invitations')
  return { success: true }
}

/**
 * 초대 삭제 (미사용 초대만)
 */
export async function deleteInvitation(id: string): Promise<{ success?: boolean; error?: string }> {
  const { supabase } = await verifyAdmin()

  const { error } = await supabase
    .from('user_invitations')
    .delete()
    .eq('id', id)
    .is('used_at', null)

  if (error) return { error: `삭제 실패: ${error.message}` }

  await auditLog(supabase, 'invitation.delete', { targetType: 'invitation', targetId: id })

  revalidatePath('/admin/invitations')
  return { success: true }
}
