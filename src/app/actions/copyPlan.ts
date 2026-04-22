'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

function normalizeMonth(month: string): string {
  return month.slice(0, 7) + '-01'
}

function prevMonth(month: string): string {
  const [y, mo] = month.split('-').map(Number)
  const py = mo === 1 ? y - 1 : y
  const pmo = mo === 1 ? 12 : mo - 1
  return `${py}-${String(pmo).padStart(2, '0')}-01`
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

export async function copyMonthlyPlans(
  participantId: string,
  toMonth: string,
): Promise<{ copied: number; skipped: number; error?: string }> {
  const { ok, error, supabase, user } = await assertStaff()
  if (!ok || !user) return { copied: 0, skipped: 0, error: error ?? '권한이 없습니다.' }

  const to = normalizeMonth(toMonth)
  const from = prevMonth(to)

  const { data: fromPlans, error: fetchErr } = await supabase
    .from('monthly_plans')
    .select('order_index, title, description, funding_source_id, support_goal_id, planned_budget, target_count')
    .eq('participant_id', participantId)
    .eq('month', from)
    .order('order_index', { ascending: true })

  if (fetchErr) return { copied: 0, skipped: 0, error: fetchErr.message }
  if (!fromPlans || fromPlans.length === 0) {
    return { copied: 0, skipped: 0, error: '전월에 복사할 계획이 없습니다.' }
  }

  const { data: existingPlans } = await supabase
    .from('monthly_plans')
    .select('order_index')
    .eq('participant_id', participantId)
    .eq('month', to)

  const existingOrders = new Set((existingPlans || []).map((p: any) => p.order_index))

  let copied = 0
  let skipped = 0

  for (const plan of fromPlans) {
    if (existingOrders.has(plan.order_index)) {
      skipped++
      continue
    }
    const { error: insErr } = await supabase
      .from('monthly_plans')
      .insert({
        participant_id: participantId,
        month: to,
        order_index: plan.order_index,
        title: plan.title,
        description: plan.description ?? null,
        funding_source_id: plan.funding_source_id ?? null,
        support_goal_id: plan.support_goal_id ?? null,
        planned_budget: plan.planned_budget,
        target_count: plan.target_count ?? null,
        scheduled_dates: [],
        creator_id: user.id,
      })
    if (!insErr) copied++
  }

  if (copied > 0) {
    revalidatePath(`/supporter/evaluations/${participantId}/${to}`)
    revalidatePath(`/supporter/evaluations/${participantId}/${to}/plans`)
  }

  return { copied, skipped }
}

export async function getPrevMonthEvaluation(participantId: string, month: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const to = normalizeMonth(month)
  const from = prevMonth(to)

  const { data } = await supabase
    .from('evaluations')
    .select('*')
    .eq('participant_id', participantId)
    .eq('month', from)
    .single()

  return data ?? null
}
