'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { UIPreferences, OPTIONAL_BLOCKS } from '@/types/ui-preferences'

export async function saveUIPreferences(participantId: string, preferences: UIPreferences) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 권한 확인: 본인이거나 admin/supporter
  const isSelf = user.id === participantId
  if (!isSelf) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
      throw new Error('Forbidden')
    }
  }

  // enabled_blocks 유효성 검증 (OPTIONAL_BLOCKS 외 값 제거)
  const validBlocks = preferences.enabled_blocks.filter(b =>
    (OPTIONAL_BLOCKS as string[]).includes(b)
  )
  const sanitized: UIPreferences = { enabled_blocks: validBlocks }

  const { error } = await supabase
    .from('participants')
    .update({ ui_preferences: sanitized })
    .eq('id', participantId)

  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath(`/admin/participants/${participantId}/preview`)
}
