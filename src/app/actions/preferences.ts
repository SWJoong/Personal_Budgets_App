'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sanitizeUIPreferences, type UIPreferences } from '@/utils/uiPreferences'

/**
 * 화면 개인화(ui_preferences) 읽기/저장. 설계: goala_ui_preferences_W.md §5.
 * ui_preferences 는 신뢰할 수 없는 클라이언트 JSON → 저장·읽기 모두 sanitizeUIPreferences 로 정규화.
 * 보안은 RLS(participants_update = seoul_can_access) + 트리거(protect_participant_fields:
 * 본인은 ui_preferences 만 통과)가 최종 방어. verify_ui_preferences_rls.sql 로 회귀 잠금.
 */

/** 읽고 정규화. 행이 없거나 값이 조작돼도 항상 유효한 기본형을 돌려준다. */
export async function getUIPreferences(participantId: string): Promise<UIPreferences> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('participants')
    .select('ui_preferences')
    .eq('id', participantId)
    .maybeSingle()
  return sanitizeUIPreferences(data?.ui_preferences ?? null)
}

/**
 * 저장 — 본인(RLS·트리거로 ui_preferences 만) 또는 담당(전 필드 가능). sanitize 후 UPDATE.
 * 권한 없으면 RLS 로 0행 → 친절 메시지.
 */
export async function saveUIPreferences(
  participantId: string,
  raw: unknown
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요해요.' }

  const clean = sanitizeUIPreferences(raw)

  const { data, error } = await supabase
    .from('participants')
    .update({ ui_preferences: clean })
    .eq('id', participantId)
    .select('id')
    .maybeSingle()

  if (error) return { error: '화면 설정을 저장하지 못했어요.' }
  if (!data) return { error: '이 화면을 바꿀 권한이 없어요.' }

  revalidatePath('/')
  return { success: true }
}
