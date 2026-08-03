'use server'

import { createClient } from '@/utils/supabase/server'
import { assertAdmin } from '@/utils/supabase/staff'
import { revalidatePath } from 'next/cache'

export interface SelectionInput {
  applicationId: string
  isSelected: boolean
  selectionReason?: string
  decidedById?: string
}

/**
 * 선정 결정 (관리자 전용 — 심의주체 구성은 미결 3번, 확정 전까지 admin 이 대행)
 *
 * DB 트리거가 (2) 동의 2종 완료 를 선정 시점에 강제한다
 * (seoul_enforce_consent_precondition). 여기서 다시 검사하지 않고 트리거 예외
 * 메시지를 그대로 사용자에게 전달한다 — 같은 검증을 두 곳에 두면 나중에 어긋난다.
 *
 * 복지부 시범사업 중복(1)은 앱이 막지 않는다 — 확인은 수행기관이 하며, 선정 화면이
 * "복지부 참여로 기록돼 있음"을 경고로 띄운다(기관 확인). 예전의 배제 트리거는 제거됐다.
 */
export async function decideSelection(input: SelectionInput) {
  try {
    const { supabase } = await assertAdmin()

    const { error } = await supabase
      .from('seoul_selection_decisions')
      .upsert(
        {
          application_id: input.applicationId,
          is_selected: input.isSelected,
          selection_reason: input.selectionReason || null,
          decided_by_id: input.decidedById || null,
        },
        { onConflict: 'application_id' }
      )

    if (error) return { error: `선정 결정 실패: ${error.message}` }

    const { data: statusRow, error: statusError } = await supabase
      .from('seoul_applications')
      .update({ status: input.isSelected ? 'selected' : 'not_selected' })
      .eq('id', input.applicationId)
      .select('id')
      .maybeSingle()

    if (statusError) return { error: `선정은 저장됐지만 신청서 상태 갱신에 실패했어요: ${statusError.message}` }
    if (!statusRow) return { error: '선정은 저장됐지만 해당 신청서를 찾을 수 없어 상태를 갱신하지 못했어요.' }

    revalidatePath('/supporter/applications')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 선정 결정 조회 — 참여자 본인·담당 실무자·관리자 모두 RLS 로 걸러진 채 볼 수 있다 */
export async function getSelectionDecision(applicationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', decision: null }

  const { data, error } = await supabase
    .from('seoul_selection_decisions')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle()

  if (error) return { error: error.message, decision: null }
  return { decision: data }
}
