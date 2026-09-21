'use server'

import { createClient } from '@/utils/supabase/server'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import { planFeedbackValid, type PlanFeedbackKind } from '@/utils/planFeedback'
import { revalidatePath } from 'next/cache'

/**
 * 계획 피드백 — 당사자가 이용계획에 "확인했어요/궁금해요"를 남긴다(축A 자기주도·읽기전용 원칙 위 가벼운 소통).
 * 설계: docs/release/14 P2(④a). DB: supabase/seoul/19_plan_feedback.sql (RLS 작성=본인·열람=본인/담당/관리자).
 *
 * ★participant_id 는 클라 입력이 아니라 서버가 getCurrentParticipant() 로 도출(위조 차단). RLS insert 도
 *   seoul_is_self 로 이중 방어. 세션 클라이언트로 호출(RLS 적용).
 */
export async function sendPlanFeedback(
  planId: string | null,
  kind: PlanFeedbackKind,
  message?: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const participant = await getCurrentParticipant()
    if (!participant) return { error: '로그인이 필요해요.' }
    if (!planFeedbackValid(kind, message)) return { error: '궁금한 점을 적어 주세요.' }

    const supabase = await createClient()
    const { error } = await supabase.from('seoul_plan_feedback').insert({
      participant_id: participant.id,
      plan_id: planId,
      kind,
      message: message?.trim() || null,
    })
    if (error) return { error: '보내지 못했어요. 잠시 후 다시 해주세요.' }

    revalidatePath('/my-plan')
    return { success: true }
  } catch {
    return { error: '오류가 발생했어요.' }
  }
}

export interface PlanFeedbackRow {
  id: string
  kind: string
  message: string | null
  created_at: string
}

/** 특정 당사자의 계획 피드백 — 세션 클라이언트로 조회(RLS: 본인·담당 실무자·관리자만). 최신순. */
export async function getPlanFeedback(participantId: string): Promise<PlanFeedbackRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('seoul_plan_feedback')
    .select('id, kind, message, created_at')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
  return (data ?? []) as PlanFeedbackRow[]
}
