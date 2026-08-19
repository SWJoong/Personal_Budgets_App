import { createClient } from '@/utils/supabase/server'

export interface CurrentParticipant {
  id: string
  name: string | null
  email: string | null
  birth_date: string | null
  disability_type: string | null
  support_grade: string | null
  assigned_supporter_id: string | null
  ui_preferences: Record<string, unknown> | null
}

/**
 * 로그인한 사용자(auth.uid())에 연결된 participants 행을 찾는다.
 *
 * participants.id 는 기관이 발급하는 내부 키이고 로그인 계정과 무관하다 —
 * 로그인 계정과의 연결 고리는 participants.auth_user_id 다. 이 함수 밖에서
 * `.from('participants').eq('id', user.id)` 처럼 직접 비교하지 않는다.
 * (그 비교가 정확히 기존 앱의 결함이었다 — 구글 로그인 사용자는 참여자 id 와
 * 로그인 id 가 다르므로 자기 데이터를 영영 못 봤다.)
 *
 * 아직 기관이 등록하지 않았거나 이메일이 일치하지 않아 연결되지 않은 로그인은
 * `null` 을 반환한다 — 화면은 이 경우를 "아직 예산 정보가 없어요" 로 다뤄야 한다.
 */
export async function getCurrentParticipant(): Promise<CurrentParticipant | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('participants')
    .select('id, name, email, birth_date, disability_type, support_grade, assigned_supporter_id, ui_preferences')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  return (data as CurrentParticipant | null) ?? null
}

/** getCurrentParticipant() 와 동시에 로그인 사용자 자체도 필요할 때. */
export async function getCurrentParticipantWithUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, participant: null }

  const { data } = await supabase
    .from('participants')
    .select('id, name, email, birth_date, disability_type, support_grade, assigned_supporter_id, ui_preferences')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  return { user, participant: (data as CurrentParticipant | null) ?? null }
}
