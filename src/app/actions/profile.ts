'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('인증이 필요합니다.')

  const name = formData.get('name') as string
  const bio = formData.get('bio') as string
  const role = formData.get('role') as string

  // Prevent changing to admin via form
  const ADMIN_EMAILS = ['swjoong@nowondaycare.org']
  const allowedRole = ADMIN_EMAILS.includes(user.email || '')
    ? role
    : (role === 'admin' ? 'participant' : role)

  const { error } = await supabase
    .from('profiles')
    .update({
      name: name?.trim() || null,
      bio: bio?.trim() || null,
      role: allowedRole,
    })
    .eq('id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/')
  return { success: true }
}
