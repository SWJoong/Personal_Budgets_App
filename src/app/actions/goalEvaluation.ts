'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type AchievementStatus = 'achieved' | 'in_progress' | 'not_achieved'

export interface GoalEvaluationInput {
  id?: string
  evaluation_id: string
  support_goal_id: string
  tried?: string | null
  achievement?: AchievementStatus | null
  learned?: string | null
  satisfied?: string | null
  dissatisfied?: string | null
  next_plan?: string | null
  target_value?: number | null
  actual_value?: number | null
}

export interface GoalEvaluation {
  id: string
  evaluation_id: string
  support_goal_id: string
  tried: string | null
  achievement: AchievementStatus | null
  learned: string | null
  satisfied: string | null
  dissatisfied: string | null
  next_plan: string | null
  target_value: number | null
  actual_value: number | null
  creator_id: string
  created_at: string
  updated_at: string
  support_goal?: { id: string; support_area: string; order_index: number } | null
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

export async function getGoalEvaluations(evaluationId: string): Promise<GoalEvaluation[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('goal_evaluations')
    .select('*, support_goal:support_goals ( id, support_area, order_index )')
    .eq('evaluation_id', evaluationId)
    .order('created_at', { ascending: true })
  return (data || []).map((g: any) => ({
    ...g,
    support_goal: Array.isArray(g.support_goal) ? g.support_goal[0] ?? null : g.support_goal ?? null,
  })) as GoalEvaluation[]
}

export async function upsertGoalEvaluation(input: GoalEvaluationInput, participantId: string) {
  const { ok, error, supabase, user } = await assertStaff()
  if (!ok || !user) return { error: error || '권한이 없습니다.' }

  const payload = {
    evaluation_id: input.evaluation_id,
    support_goal_id: input.support_goal_id,
    tried: input.tried?.trim() || null,
    achievement: input.achievement || null,
    learned: input.learned?.trim() || null,
    satisfied: input.satisfied?.trim() || null,
    dissatisfied: input.dissatisfied?.trim() || null,
    next_plan: input.next_plan?.trim() || null,
    target_value: input.target_value ?? null,
    actual_value: input.actual_value ?? null,
    creator_id: user.id,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error: upErr } = await supabase
      .from('goal_evaluations')
      .update(payload)
      .eq('id', input.id)
    if (upErr) return { error: upErr.message }
  } else {
    const { error: insErr } = await supabase
      .from('goal_evaluations')
      .insert(payload)
    if (insErr) return { error: insErr.message }
  }

  revalidatePath(`/supporter/evaluations/${participantId}`)
  return { success: true }
}

export async function upsertGoalEvaluationsBatch(
  inputs: GoalEvaluationInput[],
  participantId: string
) {
  const { ok, error, supabase, user } = await assertStaff()
  if (!ok || !user) return { error: error || '권한이 없습니다.' }

  for (const input of inputs) {
    const payload = {
      evaluation_id: input.evaluation_id,
      support_goal_id: input.support_goal_id,
      tried: input.tried?.trim() || null,
      achievement: input.achievement || null,
      learned: input.learned?.trim() || null,
      satisfied: input.satisfied?.trim() || null,
      dissatisfied: input.dissatisfied?.trim() || null,
      next_plan: input.next_plan?.trim() || null,
      target_value: input.target_value ?? null,
      actual_value: input.actual_value ?? null,
      creator_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error: upErr } = await supabase
        .from('goal_evaluations')
        .update(payload)
        .eq('id', input.id)
      if (upErr) return { error: upErr.message }
    } else {
      const { error: insErr } = await supabase
        .from('goal_evaluations')
        .insert(payload)
      if (insErr) return { error: insErr.message }
    }
  }

  revalidatePath(`/supporter/evaluations/${participantId}`)
  return { success: true }
}

export async function deleteGoalEvaluation(id: string, participantId: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return { error: '데모 모드에서는 삭제할 수 없습니다.' }

  const { ok, error, supabase } = await assertStaff()
  if (!ok) return { error: error || '권한이 없습니다.' }

  const { error: delErr } = await supabase
    .from('goal_evaluations')
    .delete()
    .eq('id', id)
  if (delErr) return { error: delErr.message }

  revalidatePath(`/supporter/evaluations/${participantId}`)
  return { success: true }
}
