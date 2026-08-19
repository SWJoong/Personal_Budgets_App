'use server'

import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'

/** 실무자용 계획 목록 — 참여자별 상세 정보는 화면에서 별도로 붙인다 */
export async function getUtilizationPlans() {
  try {
    const { supabase } = await assertStaff()
    const { data, error } = await supabase
      .from('seoul_utilization_plans')
      .select('id, participant_id, cohort_id, status, plan_period_start, plan_period_end, created_at')
      .order('created_at', { ascending: false })

    if (error) return { error: error.message, plans: [] }
    return { plans: data ?? [] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.', plans: [] }
  }
}

export interface UtilizationPlanInput {
  participantId: string
  applicationId: string
  authoredWithSupport?: 'self' | 'with_support' | 'by_supporter'
  assistedById?: string
  planPeriodStart?: string
  planPeriodEnd?: string
}

/**
 * 이용계획 생성 — 수행기관 담당자(사회복지사) 전용.
 *
 * 기관 확인(2026-07-31): 계획 신청서는 담당자가 작성하고 당사자는 제출 전
 * 열람만 한다. RLS(04_seoul_rls.sql)도 이 표의 쓰기를 담당자로 제한하지만,
 * 여기서 assertStaff() 로 먼저 걸러 당사자에게는 원문 RLS 에러 대신 명확한
 * 메시지를 준다.
 *
 * cohort_id 는 호출자가 넘기지 않는다 — 신청서가 이미 차수를 알고 있으므로
 * 여기서 그대로 물려받는다. 호출자가 따로 넘기면 신청서와 다른 차수를 실수로
 * 넣을 수 있다.
 */
export async function createUtilizationPlan(input: UtilizationPlanInput) {
  try {
    const { supabase } = await assertStaff()

    const { data: application } = await supabase
      .from('seoul_applications')
      .select('status, cohort_id')
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
        cohort_id: application.cohort_id,
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
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export async function updateUtilizationPlan(
  planId: string,
  input: Partial<Pick<UtilizationPlanInput, 'authoredWithSupport' | 'assistedById' | 'planPeriodStart' | 'planPeriodEnd'>>
) {
  try {
    const { supabase } = await assertStaff()

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
    // 담당이 아니면 RLS 로 0행이 된다 — assertStaff 는 "실무자인지"만 보므로
    // 담당 여부는 여기서 행 유무로 확인한다.
    if (!data) return { error: '이 계획을 수정할 권한이 없거나 존재하지 않아요.' }

    revalidatePath('/plan')
    revalidatePath('/supporter/plans')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 제출 — 담당자가 계획을 심의에 올린다(draft→submitted) */
export async function submitUtilizationPlan(planId: string) {
  try {
    const { supabase } = await assertStaff()

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
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
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

/** "나의 상황" 5항목 — 계획 하나당 1행, upsert. 계획의 일부라 담당자가 작성한다. */
export async function upsertSelfNarrative(input: SelfNarrativeInput) {
  try {
    const { supabase } = await assertStaff()

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

    if (error) return { error: `작성 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '이 계획을 수정할 권한이 없거나 존재하지 않아요.' }

    revalidatePath('/plan')
    revalidatePath('/supporter/plans')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export interface RequestedServiceInput {
  planId: string
  priority: number
  serviceName: string
  domainId?: string
  estimatedCost?: number
}

/** 요청 서비스 항목 — 계획+우선순위 당 1행, upsert. 계획의 일부라 담당자가 작성한다. */
export async function upsertRequestedService(input: RequestedServiceInput) {
  try {
    const { supabase } = await assertStaff()

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
    if (!data) return { error: '이 계획을 수정할 권한이 없거나 존재하지 않아요.' }

    revalidatePath('/plan')
    revalidatePath('/supporter/plans')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export async function deleteRequestedService(id: string) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_requested_services')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return { error: `삭제 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '삭제할 권한이 없거나 이미 삭제됐어요.' }

    revalidatePath('/plan')
    revalidatePath('/supporter/plans')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
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
