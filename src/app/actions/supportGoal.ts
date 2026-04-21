'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SupportGoalInput {
  id?: string
  care_plan_id: string
  participant_id: string
  order_index: number
  support_area: string
  is_to_goal?: boolean
  is_for_whom?: boolean
  needed_support?: string | null
  outcome_goal?: string | null
  strategy?: string | null
  linked_services?: string | null
  eval_tool?: string | null
  eval_target?: string | null
  is_active?: boolean
}

export interface SupportGoal {
  id: string
  care_plan_id: string
  participant_id: string
  order_index: number
  support_area: string
  is_to_goal: boolean
  is_for_whom: boolean
  needed_support: string | null
  outcome_goal: string | null
  strategy: string | null
  linked_services: string | null
  eval_tool: string | null
  eval_target: string | null
  is_active: boolean
  creator_id: string
  created_at: string
  updated_at: string
}

async function assertStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '인증 필요', supabase, user: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { ok: false, error: '권한이 없습니다.', supabase, user }
  }
  return { ok: true, error: null, supabase, user }
}

export async function getSupportGoals(carePlanId: string): Promise<SupportGoal[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('support_goals')
    .select('*')
    .eq('care_plan_id', carePlanId)
    .order('order_index', { ascending: true })
  return (data || []) as SupportGoal[]
}

export async function upsertSupportGoal(input: SupportGoalInput) {
  const { ok, error, supabase, user } = await assertStaff()
  if (!ok || !user) return { error: error || '권한이 없습니다.' }

  if (!input.support_area?.trim()) return { error: '지원 영역을 입력해주세요.' }
  if (input.order_index < 1 || input.order_index > 10) {
    return { error: '목표 순서는 1-10 사이여야 합니다.' }
  }

  const payload = {
    care_plan_id: input.care_plan_id,
    participant_id: input.participant_id,
    order_index: input.order_index,
    support_area: input.support_area.trim(),
    is_to_goal: input.is_to_goal ?? false,
    is_for_whom: input.is_for_whom ?? false,
    needed_support: input.needed_support?.trim() || null,
    outcome_goal: input.outcome_goal?.trim() || null,
    strategy: input.strategy?.trim() || null,
    linked_services: input.linked_services?.trim() || null,
    eval_tool: input.eval_tool?.trim() || null,
    eval_target: input.eval_target?.trim() || null,
    is_active: input.is_active ?? true,
    creator_id: user.id,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error: upErr } = await supabase
      .from('support_goals')
      .update(payload)
      .eq('id', input.id)
    if (upErr) return { error: upErr.message }
  } else {
    const { error: insErr } = await supabase
      .from('support_goals')
      .insert(payload)
    if (insErr) return { error: insErr.message }
  }

  revalidatePath(`/supporter/evaluations/${input.participant_id}`)
  return { success: true }
}

export async function deleteSupportGoal(id: string, participantId: string) {
  const { ok, error, supabase } = await assertStaff()
  if (!ok) return { error: error || '권한이 없습니다.' }

  const { error: delErr } = await supabase
    .from('support_goals')
    .delete()
    .eq('id', id)
  if (delErr) return { error: delErr.message }

  revalidatePath(`/supporter/evaluations/${participantId}`)
  return { success: true }
}

export async function reorderSupportGoals(
  goals: { id: string; order_index: number }[]
) {
  const { ok, error, supabase } = await assertStaff()
  if (!ok) return { error: error || '권한이 없습니다.' }

  const updates = goals.map(g =>
    supabase
      .from('support_goals')
      .update({ order_index: g.order_index, updated_at: new Date().toISOString() })
      .eq('id', g.id)
  )
  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }

  return { success: true }
}
