'use server'

import { createClient } from '@/utils/supabase/server'
import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'

export interface AppealInput {
  notificationId: string
  participantId: string
  ground: string
  filedBySelf?: boolean
}

/**
 * 이의신청 제기 — 당사자 본인이 반드시 직접 할 수 있어야 한다(RLS: seoul_appeals_insert,
 * verify_02_rls.sql S3 에서 이미 검증됨). 실무자가 대신 넣을 수 있다면 그건 권리구제가
 * 아니라는 04_seoul_rls.sql 의 설계 원칙을 그대로 따른다 — 그래서 로그인 여부만 확인하고
 * 나머지는 RLS(seoul_can_access)에 맡긴다.
 *
 * due_on(기한)은 여기서 계산하지 않는다 — trg_seoul_appeal_due 트리거가
 * notified_on + cohort.appeal_due_days 로 자동 채운다.
 */
export async function fileAppeal(input: AppealInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase
    .from('seoul_appeals')
    .insert({
      notification_id: input.notificationId,
      participant_id: input.participantId,
      ground: input.ground,
      filed_by_self: input.filedBySelf ?? true,
    })
    .select('id')
    .single()

  if (error || !data) return { error: friendlyDbError(error, '이미 이의신청을 낸 통지예요.') }

  revalidatePath('/')
  revalidatePath('/supporter/appeals')
  return { success: true, appealId: data.id as string }
}

export interface AppealRow {
  id: string
  notification_id: string
  participant_id: string
  filed_on: string
  ground: string
  filed_by_self: boolean
  due_on: string | null
  outcome: string
  outcome_reason: string | null
  decided_on: string | null
}

/** 참여자 본인 또는 실무자 — RLS 가 실제 볼 수 있는 범위를 정한다 */
export async function getAppeals(participantId?: string): Promise<{ error?: string; appeals: AppealRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', appeals: [] }

  let query = supabase
    .from('seoul_appeals')
    .select('id, notification_id, participant_id, filed_on, ground, filed_by_self, due_on, outcome, outcome_reason, decided_on')
    .order('filed_on', { ascending: false })

  if (participantId) query = query.eq('participant_id', participantId)

  const { data, error } = await query
  if (error) return { error: error.message, appeals: [] }
  return { appeals: (data ?? []) as AppealRow[] }
}

/**
 * 이의신청 결과 결정 — 실무자·관리자 전용(RLS: seoul_appeals_update).
 * 결과(outcome)는 위원회가 정하는 것이라 참여자 본인은 절대 바꿀 수 없다
 * (verify_02_rls.sql S6 에서 이미 검증됨).
 */
export async function decideAppeal(
  id: string,
  input: { outcome: 'upheld' | 'partially_upheld' | 'dismissed'; outcomeReason?: string; decidedOn?: string }
) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_appeals')
      .update({
        outcome: input.outcome,
        outcome_reason: input.outcomeReason || null,
        decided_on: input.decidedOn || new Date().toISOString().slice(0, 10),
      })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return { error: `처리 실패: ${error.message}` }
    if (!data) return { error: '수정할 권한이 없거나 존재하지 않는 이의신청이에요.' }

    revalidatePath('/supporter/appeals')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}
