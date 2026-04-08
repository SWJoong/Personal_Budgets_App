'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const participantId = formData.get('participant_id') as string
  const title = formData.get('title') as string
  const fileType = formData.get('file_type') as string
  const file = formData.get('file') as File | null
  const externalUrl = formData.get('url') as string

  let finalUrl = externalUrl

  if (file && file.size > 0) {
    const fileName = `${participantId}/${Math.random().toString(36).substring(2)}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) throw new Error('파일 업로드 실패: ' + uploadError.message)

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)
    finalUrl = publicUrl
  }

  if (!finalUrl) throw new Error('파일 또는 링크를 입력해주세요.')

  const { error } = await supabase.from('file_links').insert({
    participant_id: participantId,
    title,
    url: finalUrl,
    file_type: fileType,
  })

  if (error) throw new Error('DB 저장 실패: ' + error.message)

  revalidatePath('/supporter/documents')
  revalidatePath('/more')
  return { success: true }
}

export async function deleteDocument(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('file_links').delete().eq('id', id)
  if (error) throw error

  revalidatePath('/supporter/documents')
  return { success: true }
}
