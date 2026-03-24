'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { revalidatePath } from 'next/cache'

export async function uploadDocument(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const participantId = formData.get('participant_id') as string
  const title = formData.get('title') as string
  const fileType = formData.get('file_type') as string
  const file = formData.get('file') as File | null
  const externalUrl = formData.get('url') as string // 구글 드라이브 등 외부 링크용

  let finalUrl = externalUrl

  // 실제 파일이 업로드된 경우
  if (file && file.size > 0) {
    const fileName = `${participantId}/${Math.random().toString(36).substring(2)}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents') // 'documents' 버킷 필요
      .upload(fileName, file)

    if (uploadError) throw new Error('파일 업로드 실패: ' + uploadError.message)

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)
    
    finalUrl = publicUrl
  }

  if (!finalUrl) throw new Error('파일 또는 링크를 입력해주세요.')

  const { error } = await supabase
    .from('file_links')
    .insert({
      participant_id: participantId,
      title,
      url: finalUrl,
      file_type: fileType,
    })

  if (error) throw new Error('DB 저장 실패: ' + error.message)

  revalidatePath('/supporter/documents')
  revalidatePath('/more') // 당사자 화면 갱신
  return { success: true }
}

export async function deleteDocument(id: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      },
    }
  )

  const { error } = await supabase.from('file_links').delete().eq('id', id)
  if (error) throw error

  revalidatePath('/supporter/documents')
  return { success: true }
}
