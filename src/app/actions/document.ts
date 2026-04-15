'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * 클라이언트 직접 업로드용 서명 URL 발급
 * 파일은 브라우저 → Supabase Storage로 직접 전송 (Vercel body limit 우회)
 */
export async function getDocumentUploadUrl(
  participantId: string,
  originalFileName: string,
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const safeFileName = originalFileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
  const filePath = `${participantId}/${Date.now()}-${safeFileName}`

  const { data, error } = await admin.storage
    .from('documents')
    .createSignedUploadUrl(filePath)

  if (error) return { error: '업로드 URL 생성 실패: ' + error.message }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}

/**
 * 클라이언트 직접 업로드 완료 후 DB 레코드 저장
 */
export async function saveDocumentRecord(
  participantId: string,
  title: string,
  fileType: string,
  filePath: string,
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

  const { error } = await admin.from('file_links').insert({
    participant_id: participantId,
    title,
    url: publicUrl,
    file_type: fileType,
  })

  if (error) return { error: 'DB 저장 실패: ' + error.message }

  revalidatePath('/supporter/documents')
  return { success: true }
}

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

    // File 객체를 Buffer로 변환 (서버 환경에서 비이미지 파일의 스트리밍 문제 방지)
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(fileName, buffer, { upsert: true, contentType })

    if (uploadError) {
      throw new Error(`파일 업로드 실패 [${uploadError.message}] (파일: ${file.name}, 타입: ${contentType}, 크기: ${file.size}B)`)
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
  return { success: true }
}

export async function deleteDocument(id: string) {
  const admin = createAdminClient()

  const { error } = await admin.from('file_links').delete().eq('id', id)
  if (error) throw error

  revalidatePath('/supporter/documents')
  return { success: true }
}
