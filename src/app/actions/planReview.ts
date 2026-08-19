'use server'

import { createClient } from '@/utils/supabase/server'
import { assertAdmin, assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'

export interface PlanReviewInput {
  planId: string
  committeeId?: string
  decision: 'approved' | 'conditional' | 'rejected'
  reason?: string
}

/**
 * 심의 결과 등록 (관리자 전용 — 심의주체 구성은 미결 3번, 확정 전까지 admin 이 대행)
 *
 * DB CHECK 제약이 "승인이 아니면 사유 필수"를 이미 강제하지만, 여기서 먼저
 * 확인해 더 친절한 메시지를 준다. 결정과 동시에 계획 상태도 맞춰 바꾼다 —
 * "사유 없는 부결은 이의신청을 불가능하게 만든다"는 스키마 주석과 같은 이유로,
 * 부결·조건부는 반드시 사유를 남긴다.
 */
export async function decidePlanReview(input: PlanReviewInput) {
  if (input.decision !== 'approved' && !input.reason?.trim()) {
    return { error: '승인이 아닌 경우 사유를 반드시 입력해야 해요.' }
  }

  try {
    const { supabase } = await assertAdmin()

    const { data, error } = await supabase
      .from('seoul_plan_reviews')
      .insert({
        plan_id: input.planId,
        committee_id: input.committeeId || null,
        decision: input.decision,
        reason: input.reason || null,
      })
      .select('id')
      .single()

    if (error || !data) return { error: `심의 등록 실패: ${friendlyDbError(error)}` }

    const { data: statusRow, error: statusError } = await supabase
      .from('seoul_utilization_plans')
      .update({ status: input.decision })
      .eq('id', input.planId)
      .select('id')
      .maybeSingle()

    if (statusError) return { error: `심의는 저장됐지만 계획 상태 갱신에 실패했어요: ${statusError.message}` }
    if (!statusRow) return { error: '심의는 저장됐지만 해당 계획을 찾을 수 없어 상태를 갱신하지 못했어요.' }

    // 승인·조건부승인이면 예산을 배정한다 — seoul_service_usages.allocation_id 가
    // NOT NULL 이라 이 행이 없으면 집행(Phase 3) 자체가 불가능하다. 차수의 기본
    // 한도를 그대로 물려받고, 계획에 기간이 있으면 그걸 쓰고 없으면 차수 기간을 쓴다.
    if (input.decision === 'approved' || input.decision === 'conditional') {
      const { data: plan } = await supabase
        .from('seoul_utilization_plans')
        .select('participant_id, cohort_id, plan_period_start, plan_period_end')
        .eq('id', input.planId)
        .single()

      if (plan) {
        const { data: cohort } = await supabase
          .from('seoul_cohorts')
          .select('monthly_ceiling, total_ceiling, period_months, carry_over_allowed, starts_on, ends_on')
          .eq('id', plan.cohort_id)
          .single()

        if (cohort) {
          const { error: allocationError } = await supabase
            .from('seoul_budget_allocations')
            .upsert(
              {
                participant_id: plan.participant_id,
                plan_id: input.planId,
                review_id: data.id,
                cohort_id: plan.cohort_id,
                monthly_ceiling: cohort.monthly_ceiling,
                total_ceiling: cohort.total_ceiling,
                period_months: cohort.period_months,
                carry_over_allowed: cohort.carry_over_allowed,
                allocated_amount: cohort.total_ceiling,
                starts_on: plan.plan_period_start || cohort.starts_on,
                ends_on: plan.plan_period_end || cohort.ends_on,
              },
              { onConflict: 'plan_id' }
            )

          if (allocationError) {
            return { error: `심의는 저장됐지만 예산 배정에 실패했어요: ${allocationError.message}` }
          }
        }
      }
    }

    revalidatePath('/supporter/reviews')
    revalidatePath('/plan')
    return { success: true, reviewId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export interface NotificationInput {
  reviewId: string
  participantId: string
  method?: 'mail' | 'sms' | 'in_person' | 'app'
  notifiedOn?: string
}

/** 통지 발송 기록 (실무자·관리자) — 이의신청 기한의 기산점이 되므로 정확한 날짜가 중요하다 */
export async function sendNotification(input: NotificationInput) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_notifications')
      .insert({
        review_id: input.reviewId,
        participant_id: input.participantId,
        method: input.method || null,
        notified_on: input.notifiedOn || undefined,
      })
      .select('id')
      .single()

    if (error || !data) return { error: `통지 등록 실패: ${friendlyDbError(error)}` }

    revalidatePath('/supporter/reviews')
    return { success: true, notificationId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/**
 * 당사자가 통지를 확인했음을 스스로 기록한다.
 *
 * seoul_notifications 는 04_seoul_rls.sql 그룹 A(행정 기록)라 UPDATE 정책이
 * 실무자·관리자 전용이다 — 그러나 "확인했는지"는 당사자가 앱을 열었을 때만
 * 알 수 있는 사실이라 실무자가 대신 기록할 수 없다. 그렇다고 그룹 A 정책 전체를
 * 참여자에게 열면 통지 내용·발송 방법까지 스스로 고칠 수 있게 된다. 그래서
 * is_read_by_participant/read_at 두 컬럼만 다루는 좁은 RPC(mark_notification_read,
 * 04_seoul_rls.sql)를 통해서만, 본인 행에 한해 기록한다.
 */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })

  if (error) return { error: `확인 처리 실패: ${error.message}` }
  if (data === false) return { error: '내 통지가 아니어서 확인 처리할 수 없어요.' }

  revalidatePath('/')
  return { success: true }
}

export interface ReviewCommitteeRow {
  id: string
  name: string
  composition_note: string | null
}

/**
 * 심의 주체 목록 — 로그인만 하면 읽을 수 있다(RLS: seoul_review_committees_read).
 * 누가 심의했는지는 통지·이의신청에서 당사자도 알아야 하는 정보다.
 */
export async function getReviewCommittees(): Promise<{ error?: string; committees: ReviewCommitteeRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', committees: [] }

  const { data, error } = await supabase
    .from('seoul_review_committees')
    .select('id, name, composition_note')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, committees: [] }
  return { committees: (data ?? []) as ReviewCommitteeRow[] }
}

/**
 * 심의 주체 기록 (관리자 전용) — 심사처가 전달한 구성을 그대로 적는다.
 *
 * ★ 정족수·구성 요건 같은 판정 로직은 만들지 않는다(기관 확인: 심의 주체 구성은
 *   심사처 전달 사항이며 기록 외 별도 로직이 불필요). composition_note 는
 *   자유 서술이며, 앱은 어떤 구성이 유효한지 판단하지 않는다.
 */
export async function createReviewCommittee(input: { name: string; compositionNote?: string }) {
  try {
    const { supabase } = await assertAdmin()

    const name = input.name.trim()
    if (!name) return { error: '심의 주체 이름을 적어주세요.' }

    const { data, error } = await supabase
      .from('seoul_review_committees')
      .insert({ name, composition_note: input.compositionNote?.trim() || null })
      .select('id')
      .single()

    if (error || !data) return { error: `심의 주체 기록 실패: ${friendlyDbError(error)}` }

    revalidatePath('/supporter/plans')
    return { success: true, committeeId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}
