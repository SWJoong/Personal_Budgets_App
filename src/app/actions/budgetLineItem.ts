'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BudgetLineItemInput {
  id?: string
  care_plan_id: string
  funding_source_id?: string | null
  support_goal_id?: string | null
  category: string
  item_name: string
  unit_cost: number
  quantity: number
  unit_label?: string | null
  calculation_note?: string | null
  order_index?: number
}

export interface BudgetLineItem {
  id: string
  care_plan_id: string
  funding_source_id: string | null
  support_goal_id: string | null
  category: string
  item_name: string
  unit_cost: number
  quantity: number
  unit_label: string | null
  calculation_note: string | null
  total_amount: number
  order_index: number
  creator_id: string
  created_at: string
  updated_at: string
  funding_source?: { id: string; name: string } | null
  support_goal?: { id: string; support_area: string } | null
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

export async function getBudgetLineItems(carePlanId: string): Promise<BudgetLineItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('budget_line_items')
    .select(`
      *,
      funding_source:funding_sources ( id, name ),
      support_goal:support_goals ( id, support_area )
    `)
    .eq('care_plan_id', carePlanId)
    .order('order_index', { ascending: true })

  return (data || []).map((item: any) => ({
    ...item,
    funding_source: Array.isArray(item.funding_source) ? item.funding_source[0] ?? null : item.funding_source ?? null,
    support_goal: Array.isArray(item.support_goal) ? item.support_goal[0] ?? null : item.support_goal ?? null,
  })) as BudgetLineItem[]
}

export async function upsertBudgetLineItem(input: BudgetLineItemInput, participantId: string) {
  const { ok, error, supabase, user } = await assertStaff()
  if (!ok || !user) return { error: error || '권한이 없습니다.' }

  if (!input.category?.trim()) return { error: '항목 분류를 입력해주세요.' }
  if (!input.item_name?.trim()) return { error: '항목 이름을 입력해주세요.' }
  if (input.unit_cost < 0) return { error: '단가는 0 이상이어야 합니다.' }
  if (input.quantity <= 0) return { error: '수량은 0보다 커야 합니다.' }

  const payload = {
    care_plan_id: input.care_plan_id,
    funding_source_id: input.funding_source_id || null,
    support_goal_id: input.support_goal_id || null,
    category: input.category.trim(),
    item_name: input.item_name.trim(),
    unit_cost: Number(input.unit_cost),
    quantity: Number(input.quantity),
    unit_label: input.unit_label?.trim() || null,
    calculation_note: input.calculation_note?.trim() || null,
    order_index: input.order_index ?? 1,
    creator_id: user.id,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error: upErr } = await supabase
      .from('budget_line_items')
      .update(payload)
      .eq('id', input.id)
    if (upErr) return { error: upErr.message }
  } else {
    const { error: insErr } = await supabase
      .from('budget_line_items')
      .insert(payload)
    if (insErr) return { error: insErr.message }
  }

  revalidatePath(`/supporter/evaluations/${participantId}`)
  return { success: true }
}

export async function deleteBudgetLineItem(id: string, participantId: string) {
  const { ok, error, supabase } = await assertStaff()
  if (!ok) return { error: error || '권한이 없습니다.' }

  const { error: delErr } = await supabase
    .from('budget_line_items')
    .delete()
    .eq('id', id)
  if (delErr) return { error: delErr.message }

  revalidatePath(`/supporter/evaluations/${participantId}`)
  return { success: true }
}

export async function getBudgetSummaryByFundingSource(
  carePlanId: string
): Promise<{ funding_source_id: string | null; funding_source_name: string | null; total: number }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('budget_line_items')
    .select('funding_source_id, total_amount, funding_source:funding_sources ( name )')
    .eq('care_plan_id', carePlanId)

  if (!data) return []

  const map = new Map<string, { name: string | null; total: number }>()
  for (const row of data as any[]) {
    const key = row.funding_source_id ?? '__null__'
    const name = Array.isArray(row.funding_source)
      ? row.funding_source[0]?.name ?? null
      : row.funding_source?.name ?? null
    const cur = map.get(key) ?? { name, total: 0 }
    cur.total += Number(row.total_amount) || 0
    map.set(key, cur)
  }

  return Array.from(map.entries()).map(([k, v]) => ({
    funding_source_id: k === '__null__' ? null : k,
    funding_source_name: v.name,
    total: v.total,
  }))
}
