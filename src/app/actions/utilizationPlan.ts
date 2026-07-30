'use server'

import { createClient } from '@/utils/supabase/server'
import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'

export interface UtilizationPlanInput {
  participantId: string
  applicationId: string
  cohortId: string
  authoredWithSupport?: 'self' | 'with_support' | 'by_supporter'
  assistedById?: string
  planPeriodStart?: string
  planPeriodEnd?: string
}

/**
 * 이용계획 생성 — 당사자 본인 또는 실무자 양쪽이 호출할 수 있다.
 *
 * 역할 분기를 코드에서 하지 않는다. RLS(supabase/seoul/04_seoul_rls.sql B-1)가
 * 이미 "본인은 draft 상태로만 만들 수 있다"를 강제하므로, 여기서는 로그인
 * 여부만 확인하고 나머지는 정책에 맡긴다 — 참여자 화면·실무자 화면 양쪽에서
 * 같은 함수를 그대로 쓸 수 있다.
 */
export async function createUtilizationPlan(input: UtilizationPlanInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: application } = await supabase
    .from('seoul_applications')
    .select('status')
    .eq('id', input.applicationId)
    .maybeSingle()

  if (application?.status !== 'selected') {
    return { error: '선정된 신청서에만 이용계획을 만들 수 있어요.' }
  }

  const { data, error } = await supabase
    .from('seoul_utilization_plans')
    .insert({
      participant_id: input.participantId,
      application_id: input.applicationId,
      cohort_id: input.cohortId,
      authored_with_support: input.authoredWithSupport || 'with_support',
      assisted_by_id: input.assistedById || null,
      plan_period_start: input.planPeriodStart || null,
      plan_period_end: input.planPeriodEnd || null,
    })
    .select('id')
    .single()

  if (error || !data) return { error: `계획 생성 실패: ${friendlyDbError(error)}` }

  revalidatePath('/plan')
  revalidatePath('/supporter/plans')
  return { success: true, planId: data.id as string }
}

export async function updateUtilizationPlan(
  planId: string,
  input: Partial<Pick<UtilizationPlanInput, 'authoredWithSupport' | 'assistedById' | 'planPeriodStart' | 'planPeriodEnd'>>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const updateData: {
    authored_with_support?: string
    assisted_by_id?: string | null
    plan_period_start?: string | null
    plan_period_end?: string | null
  } = {}
  if (input.authoredWithSupport !== undefined) updateData.authored_with_support = input.authoredWithSupport
  if (input.assistedById !== undefined) updateData.assisted_by_id = input.assistedById || null
  if (input.planPeriodStart !== undefined) updateData.plan_period_start = input.planPeriodStart || null
  if (input.planPeriodEnd !== undefined) updateData.plan_period_end = input.planPeriodEnd || null

  const { data, error } = await supabase
    .from('seoul_utilization_plans')
    .update(updateData)
    .eq('id', planId)
    .select('id')
    .maybeSingle()

  if (error) return { error: `계획 수정 실패: ${friendlyDbError(error)}` }
  // 본인은 draft/submitted 상태일 때만 고칠 수 있다(RLS). 이미 심의가 끝난 계획이면
  // 에러 없이 조용히 0행이 되므로, 행이 실제로 돌아왔는지 반드시 확인한다.
  if (!data) return { error: '지금은 이 계획을 수정할 수 없어요. 이미 심의가 진행됐을 수 있어요.' }

  revalidatePath('/plan')
  revalidatePath('/supporter/plans')
  return { success: true }
}

/** 제출 — 본인이면 draft→submitted, 실무자도 대신 제출 가능(RLS 가 상태 전이를 검증) */
export async function submitUtilizationPlan(planId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase
    .from('seoul_utilization_plans')
    .update({ status: 'submitted' })
    .eq('id', planId)
    .select('id')
    .maybeSingle()

  if (error) return { error: `제출 실패: ${friendlyDbError(error)}` }
  if (!data) return { error: '이미 제출됐거나 지금은 제출할 수 없는 상태예요.' }

  revalidatePath('/plan')
  revalidatePath('/supporter/plans')
  return { success: true }
}

export interface SelfNarrativeInput {
  planId: string
  strengthsTalents?: string
  socialBarriers?: string
  desiredChange?: string
  desiredLife?: string
  goalToTry?: string
  writtenInFirstPerson?: boolean
}

/** "나의 상황" 5항목 — 계획 하나당 1행, upsert */
export async function upsertSelfNarrative(input: SelfNarrativeInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase
    .from('seoul_self_narratives')
    .upsert(
      {
        plan_id: input.planId,
        strengths_talents: input.strengthsTalents || null,
        social_barriers: input.socialBarriers || null,
        desired_change: input.desiredChange || null,
        desired_life: input.desiredLife || null,
        goal_to_try: input.goalToTry || null,
        written_in_first_person: input.writtenInFirstPerson ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plan_id' }
    )
    .select('plan_id')
    .maybeSingle()

  // 계획이 draft 가 아니면(이미 제출·심의 진행) 본인은 더 못 고친다 — RLS 가
  // 이 경우 "new row violates row-level security policy" 같은 원문 에러를 낸다.
  if (error) return { error: `작성 실패: ${friendlyDbError(error)}` }
  if (!data) return { error: '지금은 이 계획을 수정할 수 없어요. 이미 제출됐을 수 있어요.' }

  revalidatePath('/plan')
  return { success: true }
}

export interface RequestedServiceInput {
  planId: string
  priority: number
  serviceName: string
  domainId?: string
  estimatedCost?: number
}

/** 요청 서비스 항목 — 계획+우선순위 당 1행, upsert */
export async function upsertRequestedService(input: RequestedServiceInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase
    .from('seoul_requested_services')
    .upsert(
      {
        plan_id: input.planId,
        priority: input.priority,
        service_name: input.serviceName,
        domain_id: input.domainId || null,
        estimated_cost: input.estimatedCost ?? null,
      },
      { onConflict: 'plan_id,priority' }
    )
    .select('id')
    .maybeSingle()

  if (error) return { error: `요청 서비스 저장 실패: ${friendlyDbError(error)}` }
  if (!data) return { error: '지금은 이 계획을 수정할 수 없어요. 이미 제출됐을 수 있어요.' }

  revalidatePath('/plan')
  return { success: true }
}

export async function deleteRequestedService(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase
    .from('seoul_requested_services')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return { error: `삭제 실패: ${friendlyDbError(error)}` }
  if (!data) return { error: '삭제할 권한이 없거나 이미 삭제됐어요.' }

  revalidatePath('/plan')
  return { success: true }
}

/** 요청 서비스 항목별 승인/반려 — 심의 후 실무자·관리자가 기록한다 */
export async function reviewRequestedService(id: string, input: { approvedForService: boolean; reviewNote?: string }) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_requested_services')
      .update({
        approved_for_service: input.approvedForService,
        review_note: input.reviewNote || null,
      })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return { error: `검토 결과 저장 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '수정할 권한이 없거나 존재하지 않는 항목이에요.' }

    revalidatePath('/supporter/plans')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}
