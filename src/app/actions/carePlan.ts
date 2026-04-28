'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CarePlanType, CarePlanContent } from '@/types/care-plans'

export interface CarePlanRow {
  id: string
  participant_id: string
  plan_type: string
  plan_year: number
  content: CarePlanContent
  creator_id: string | null
  created_at: string
  updated_at: string
}

/** 특정 참여자의 이용계획서 목록 조회 */
export async function getCarePlans(participantId: string, year?: number): Promise<CarePlanRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('care_plans')
    .select('*')
    .eq('participant_id', participantId)
    .order('plan_year', { ascending: false })

  if (year !== undefined) {
    query = query.eq('plan_year', year)
  }

  const { data, error } = await query
  if (error) {
    console.error('getCarePlans error:', error)
    return []
  }
  return (data || []) as CarePlanRow[]
}

/** 특정 이용계획서 단건 조회 */
export async function getCarePlan(
  participantId: string,
  planType: CarePlanType,
  planYear: number
): Promise<CarePlanRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('care_plans')
    .select('*')
    .eq('participant_id', participantId)
    .eq('plan_type', planType)
    .eq('plan_year', planYear)
    .single()

  if (error) return null
  return data as CarePlanRow
}

/** 이용계획서 저장 (upsert) */
export async function upsertCarePlan(
  participantId: string,
  planType: CarePlanType,
  planYear: number,
  content: CarePlanContent
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { success: false, error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('care_plans')
    .upsert(
      {
        participant_id: participantId,
        plan_type: planType,
        plan_year: planYear,
        content,
        creator_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'participant_id, plan_type, plan_year' }
    )

  if (error) {
    console.error('upsertCarePlan error:', error)
    return { success: false, error: '저장에 실패했습니다.' }
  }

  revalidatePath(`/supporter/documents/care-plans/${participantId}/${planType}`)
  revalidatePath('/supporter/documents')
  return { success: true }
}

/** 이용계획서 삭제 */
export async function deleteCarePlan(carePlanId: string): Promise<{ success: boolean; error?: string }> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return { success: false, error: '데모 모드에서는 삭제할 수 없습니다.' }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { success: false, error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('care_plans')
    .delete()
    .eq('id', carePlanId)

  if (error) {
    console.error('deleteCarePlan error:', error)
    return { success: false, error: '삭제에 실패했습니다.' }
  }

  revalidatePath('/supporter/documents')
  return { success: true }
}

/** 모든 당사자의 이용계획서 (서류 보관함 목록용)
 *  care_plans 테이블이 아직 생성되지 않은 경우 빈 배열 반환
 */
export async function getAllCarePlans(): Promise<CarePlanRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('care_plans')
    .select('id, participant_id, plan_type, plan_year, updated_at, creator_id, created_at, content')
    .order('plan_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    // 테이블 미생성(42P01) 등 DB 오류는 빈 배열로 처리해 페이지 크래시 방지
    console.warn('getAllCarePlans — 이용계획서 조회 실패 (migration 실행 전일 수 있음):', error.message)
    return []
  }
  return (data || []) as CarePlanRow[]
}
