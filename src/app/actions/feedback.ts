'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'

export async function saveFeedback(
  context: string,
  response: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: '인증 필요' }

    const { error } = await supabase
      .from('participant_feedback')
      .insert({ participant_id: user.id, context, response })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false }
  }
}

export interface FeedbackRow {
  id: string
  participantName: string
  context: string | null
  response: string | null
  created_at: string
}

/**
 * 당사자 피드백 목록 — 관리자 열람(§4-5). participant_feedback 는 레거시 테이블(participant_id = auth uid)이라
 * 관리자 전용 화면에서 service role 로 전량 조회하고 이름은 profiles 로 붙인다(admin 게이트로 접근 제한).
 * response 는 SelfCheckFeedback 이 남긴 감정 이모지(😊/😔), context 는 어느 화면인지.
 */
export async function getFeedback(): Promise<{ feedback: FeedbackRow[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { feedback: [], error: '인증이 필요해요.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { feedback: [], error: '관리자만 볼 수 있어요.' }

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('participant_feedback')
    .select('id, participant_id, context, response, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { feedback: [], error: error.message }

  const list = (rows ?? []) as {
    id: string
    participant_id: string
    context: string | null
    response: string | null
    created_at: string
  }[]
  if (list.length === 0) return { feedback: [] }

  const ids = [...new Set(list.map((r) => r.participant_id))]
  const { data: profiles } = await admin.from('profiles').select('id, name, full_name').in('id', ids)
  const nameById = new Map<string, string>()
  for (const p of (profiles ?? []) as { id: string; name: string | null; full_name: string | null }[]) {
    nameById.set(p.id, p.name ?? p.full_name ?? '이름 없음')
  }

  return {
    feedback: list.map((r) => ({
      id: r.id,
      participantName: nameById.get(r.participant_id) ?? '알 수 없음',
      context: r.context,
      response: r.response,
      created_at: r.created_at,
    })),
  }
}
