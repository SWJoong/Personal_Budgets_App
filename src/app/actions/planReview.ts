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
