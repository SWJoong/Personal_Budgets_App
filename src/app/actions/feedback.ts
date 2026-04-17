'use server'

import { createClient } from '@/utils/supabase/server'

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
