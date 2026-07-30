'use server'

import { assertStaff } from '@/utils/supabase/staff'
import { revalidatePath } from 'next/cache'

/**
 * 요건(criterion) 위반 플래그 검토 — 실무자 전용.
 *
 * 금지(prohibition)는 trg_seoul_check_usage 가 이미 막았으므로 여기 올 일이
 * 없다. 여기 쌓이는 것은 "계획에 없는 지출" 같은 요건 미충족뿐이다 — 자동
 * 거절이 아니라 사람이 판단하라고 남겨둔 것(1차 설계 원칙).
 */
export async function getRuleChecks(onlyPending = true) {
  try {
    const { supabase } = await assertStaff()
    let query = supabase
      .from('seoul_rule_checks')
      .select('id, usage_id, rule_id, check_result, human_decision, human_decision_reason, decided_at')
      .order('created_at', { ascending: false })

    if (onlyPending) query = query.eq('human_decision', 'pending')

    const { data, error } = await query
    if (error) return { error: error.message, ruleChecks: [] }
    return { ruleChecks: data ?? [] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.', ruleChecks: [] }
  }
}

export async function decideRuleCheck(id: string, input: { decision: 'accepted' | 'rejected'; reason?: string }) {
  try {
    const { supabase, user } = await assertStaff()
    const { data, error } = await supabase
      .from('seoul_rule_checks')
      .update({
        human_decision: input.decision,
        human_decision_reason: input.reason || null,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return { error: `처리 실패: ${error.message}` }
    if (!data) return { error: '수정할 권한이 없거나 존재하지 않는 항목이에요.' }

    revalidatePath('/supporter/review')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}
