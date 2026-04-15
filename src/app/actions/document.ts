'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadDocument(formData: FormData) {
  // 인증 확인은 사용자 세션 클라이언트로
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

  // Storage 업로드·DB 쓰기는 서비스 롤 클라이언트 사용 (RLS 우회)
  const admin = createAdminClient()

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`파일 용량이 20MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    const fileName = `${participantId}/${Date.now()}-${safeFileName}`
    // file.type이 빈 문자열인 경우(일부 브라우저/OS의 xlsx 등) 확장자 기반으로 fallback
    const ext = safeFileName.split('.').pop()?.toLowerCase() || ''
    const mimeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls:  'application/vnd.ms-excel',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc:  'application/msword',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt:  'application/vnd.ms-powerpoint',
      pdf:  'application/pdf',
      csv:  'text/csv',
      txt:  'text/plain',
      png:  'image/png',
      jpg:  'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
    }
    const contentType = file.type || mimeMap[ext] || 'application/octet-stream'
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(fileName, file, { upsert: true, contentType })

    if (uploadError) {
      if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
        throw new Error('저장소 버킷이 준비되지 않았습니다. Supabase Storage에서 "documents" 버킷을 확인해 주세요.')
      }
      throw new Error('파일 업로드 실패: ' + uploadError.message)
    }

    const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(fileName)
    finalUrl = publicUrl
  }

  if (!finalUrl) throw new Error('파일 또는 링크를 입력해주세요.')

  const { error } = await admin.from('file_links').insert({
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
  const admin = createAdminClient()

  const { error } = await admin.from('file_links').delete().eq('id', id)
  if (error) throw error

  revalidatePath('/supporter/documents')
  return { success: true }
}
