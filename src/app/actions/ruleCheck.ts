'use server'

import { createClient } from '@/utils/supabase/server'
import { assertStaff } from '@/utils/supabase/staff'
import { revalidatePath } from 'next/cache'

/**
 * 규칙 플래그 검토 — 실무자 전용.
 *
 * 여기 쌓이는 것은 "계획에 없는 지출"과 "지원이 어려운 서비스 키워드에 걸린 지출"
 * 두 가지다. 어느 쪽도 시스템이 거절한 것이 아니다 — 지원 불가 여부는 수행기관
 * 서류를 근거로 심사처가 정하고, 그 전에 당사자와 담당자의 대화에서 대부분
 * 자정된다(기관 확인). 앱의 역할은 판정이 아니라 기록과 명시다.
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
      .select('id, usage_id')
      .maybeSingle()

    if (error) return { error: `처리 실패: ${error.message}` }
    if (!data) return { error: '수정할 권한이 없거나 존재하지 않는 항목이에요.' }

    // 여기서 그친 채 두면 참여자 화면(지출 목록)은 검토 결과와 무관하게 계속
    // "확인 중"으로 남는다 — 실무자의 결정이 참여자가 보는 상태에도 반영되어야 한다.
    // 이미 정산(recovered 등)이 끝난 건은 건드리지 않는다.
    const { error: usageError } = await supabase
      .from('seoul_service_usages')
      .update({ settlement_status: input.decision === 'accepted' ? 'accepted' : 'rejected' })
      .eq('id', data.usage_id)
      .eq('settlement_status', 'pending')

    if (usageError) return { error: `검토는 저장됐지만 지출 상태 반영에 실패했어요: ${usageError.message}` }

    revalidatePath('/supporter/review')
    revalidatePath('/receipt')
    revalidatePath('/calendar')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export interface SpendingRuleRow {
  code: string
  label: string
  kind: string
  source_note: string | null
}

/**
 * 지원이 어려운 서비스 목록 — 화면에 **명시**하기 위한 조회.
 *
 * 판정 근거가 아니라 안내 문구다. 당사자와 담당자가 지출 전에 이야기를 나눌 때
 * 쓰라고 보여준다 — 이 대화에서 대부분 자정되고, 최종 판단은 심사처가 한다.
 * 로그인만 되어 있으면 볼 수 있다(제도 안내이지 개인정보가 아니다).
 */
export async function getSpendingRules(): Promise<{ error?: string; rules: SpendingRuleRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', rules: [] }

  const { data, error } = await supabase
    .from('seoul_spending_rules')
    .select('code, label, kind, source_note')
    .eq('is_active', true)
    .eq('kind', 'prohibition')
    .order('code')

  if (error) return { error: error.message, rules: [] }
  return { rules: (data ?? []) as SpendingRuleRow[] }
}
