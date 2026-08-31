'use server'

import { createClient } from '@/utils/supabase/server'
import { assertStaff } from '@/utils/supabase/staff'
import { revalidatePath } from 'next/cache'

export interface MonitoringInput {
  participantId: string
  allocationId?: string
  monitoringDate?: string
  method?: 'visit' | 'phone' | 'app' | 'document'
  observedChange?: string
  participantVoice?: string
}

/**
 * 모니터링 기록 — 실무자 전용(04_seoul_rls.sql 그룹 A).
 *
 * 서울형에는 4+1 같은 정형 평가가 없다 — 성과평가에 쓸 변화 기록은 사실상
 * 이것뿐이다(schema 주석). observed_change(실무자 관찰)와 participant_voice
 * (당사자 본인의 말)를 다른 칸에 남긴다 — 같은 칸에 섞으면 누구 말인지 사라진다.
 */
export async function recordMonitoring(input: MonitoringInput) {
  try {
    const { supabase, user } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_monitoring_records')
      .insert({
        participant_id: input.participantId,
        allocation_id: input.allocationId || null,
        caseworker_id: user.id,
        monitoring_date: input.monitoringDate || undefined,
        method: input.method || null,
        observed_change: input.observedChange || null,
        participant_voice: input.participantVoice || null,
      })
      .select('id')
      .single()

    if (error || !data) return { error: `기록 실패: ${error?.message}` }

    revalidatePath('/supporter/monitoring')
    return { success: true, monitoringId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export interface MonitoringRow {
  id: string
  participant_id: string
  monitoring_date: string
  method: string | null
  observed_change: string | null
  participant_voice: string | null
  allocation_id: string | null
}

/** 참여자 본인 또는 실무자 — RLS 가 실제 볼 수 있는 범위를 정한다 */
export async function getMonitoringRecords(participantId?: string): Promise<{ error?: string; records: MonitoringRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', records: [] }

  let query = supabase
    .from('seoul_monitoring_records')
    .select('id, participant_id, monitoring_date, method, observed_change, participant_voice, allocation_id')
    .order('monitoring_date', { ascending: false })

  if (participantId) query = query.eq('participant_id', participantId)

  const { data, error } = await query
  if (error) return { error: error.message, records: [] }
  return { records: (data ?? []) as MonitoringRow[] }
}
