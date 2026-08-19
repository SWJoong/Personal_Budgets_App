'use server'

import { createClient } from '@/utils/supabase/server'
import { assertAdmin } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'

export interface SettlementInput {
  allocationId: string
  settledPeriod: string
  acceptedAmount: number
  rejectedAmount?: number
  recoveredAmount?: number
  unusedAmount?: number
  note?: string
  settledOn?: string
}

/**
 * 정산 등록 — 관리자 전용(04_seoul_rls.sql 그룹 D).
 *
 * unused_amount 는 실패가 아니다 — "쓸 곳을 못 찾아서"인지 "필요가 없어서"인지는
 * 다르므로 모니터링 기록과 함께 읽어야 한다(schema 주석). 여기서는 숫자만 남기고
 * 해석은 화면에서 모니터링 기록과 나란히 보여준다.
 */
export async function recordSettlement(input: SettlementInput) {
  try {
    const { supabase } = await assertAdmin()

    const { data, error } = await supabase
      .from('seoul_settlements')
      .upsert(
        {
          allocation_id: input.allocationId,
          settled_period: input.settledPeriod,
          accepted_amount: input.acceptedAmount,
          rejected_amount: input.rejectedAmount ?? 0,
          recovered_amount: input.recoveredAmount ?? 0,
          unused_amount: input.unusedAmount ?? 0,
          note: input.note || null,
          settled_on: input.settledOn || undefined,
        },
        { onConflict: 'allocation_id,settled_period' }
      )
      .select('id')
      .single()

    if (error || !data) return { error: `정산 등록 실패: ${friendlyDbError(error)}` }

    revalidatePath('/supporter/settlements')
    return { success: true, settlementId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export interface SettlementRow {
  id: string
  allocation_id: string
  settled_period: string
  accepted_amount: number
  rejected_amount: number
  recovered_amount: number
  unused_amount: number
  note: string | null
  settled_on: string
}

/** 참여자 본인 또는 실무자 — RLS 가 실제 볼 수 있는 범위를 정한다 (allocation 을 통한 조인) */
export async function getSettlements(allocationId?: string): Promise<{ error?: string; settlements: SettlementRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', settlements: [] }

  let query = supabase
    .from('seoul_settlements')
    .select('id, allocation_id, settled_period, accepted_amount, rejected_amount, recovered_amount, unused_amount, note, settled_on')
    .order('settled_on', { ascending: false })

  if (allocationId) query = query.eq('allocation_id', allocationId)

  const { data, error } = await query
  if (error) return { error: error.message, settlements: [] }
  return { settlements: (data ?? []) as SettlementRow[] }
}
