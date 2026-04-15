'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const participantId = formData.get('participant_id') as string
  const title = formData.get('title') as string
  const fileType = formData.get('file_type') as string
  const file = formData.get('file') as File | null
  const externalUrl = formData.get('url') as string

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

  let finalUrl = externalUrl

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`파일 용량이 20MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    const fileName = `${participantId}/${Date.now()}-${safeFileName}`
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file, { upsert: false })

    if (uploadError) {
      // Supabase storage 버킷 미존재 시 안내
      if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
        throw new Error('저장소 버킷이 준비되지 않았습니다. 관리자에게 문의하거나 Supabase Storage에서 "documents" 버킷을 생성해 주세요.')
      }
      throw new Error('파일 업로드 실패: ' + uploadError.message)
    }

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
