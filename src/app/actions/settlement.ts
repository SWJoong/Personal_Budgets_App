'use server'

import { createClient } from '@/utils/supabase/server'
import { assertAdmin } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'
import { auditLog } from '@/utils/audit'

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

    await auditLog(supabase, 'settlement.record', {
      targetType: 'settlement',
      targetId: data.id as string,
      metadata: {
        accepted: input.acceptedAmount,
        rejected: input.rejectedAmount ?? 0,
        recovered: input.recoveredAmount ?? 0,
        unused: input.unusedAmount ?? 0,
      },
    })

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

/**
 * 참여자 본인 또는 실무자 — RLS 가 실제 볼 수 있는 범위를 정한다 (allocation 을 통한 조인).
 *
 * allocation 스코프(정산은 participant_id 가 없고 allocation_id 로만 참여자에 묶인다):
 *   - string    → .eq('allocation_id', id)        단일 배정 조회(실무자/관리자 상세 화면 하위호환)
 *   - string[]  → .in('allocation_id', ids)       view-as: 대상의 **모든** allocation(다건 배정 포함)
 *   - []        → .in('allocation_id', [sentinel]) 신규 당사자(빈 배열): 관리자 RLS 전체유출 방지, 무매칭
 *   - undefined → allocation 필터 없음             일반 당사자 RLS self(자기 모든 정산)
 */
export async function getSettlements(allocation?: string | string[]): Promise<{ error?: string; settlements: SettlementRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', settlements: [] }

  let query = supabase
    .from('seoul_settlements')
    .select('id, allocation_id, settled_period, accepted_amount, rejected_amount, recovered_amount, unused_amount, note, settled_on')
    .order('settled_on', { ascending: false })

  if (Array.isArray(allocation)) {
    // 빈 배열(신규 당사자)은 관리자 RLS 로 전체 유출되지 않게 존재할 수 없는 id 로 스코프한다.
    query = query.in('allocation_id', allocation.length ? allocation : ['00000000-0000-0000-0000-000000000000'])
  } else if (allocation) {
    query = query.eq('allocation_id', allocation)
  }

  const { data, error } = await query
  if (error) return { error: error.message, settlements: [] }
  return { settlements: (data ?? []) as SettlementRow[] }
}
