'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { viewAsWriteBlock } from '@/utils/supabase/viewAs'
import { revalidatePath } from 'next/cache'

export interface ActivityPhotoInput {
  /** base64 인코딩(접두어 없이). */
  base64: string
  mimeType?: string
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

/**
 * 활동 사진(다건) 업로드 — 당사자 본인 또는 실무자가 지출 기록 시 함께 올린다.
 * 영수증(단건, recordServiceUsage 내장)과 달리 usage 당 N장이라 별도 서버액션.
 * 버킷 activity-photos·테이블 seoul_activity_photos·경로위조 트리거는 Wave A(#117)에 이미 있음.
 *
 * ★보안(3중): ① insert 를 user 스코프로 하여 RLS(self-pending 또는 담당 staff)가 이 usage 에
 * 사진 붙일 권한을 강제 · ② 저장 경로 첫 세그먼트(참여자 id)를 클라이언트가 주지 않고 usage 에서
 * 서버가 도출(시그니처에 path 없음 = 위조 불가) · ③ Wave A 트리거 seoul_check_activity_photo_path
 * 가 접두를 DB 레벨에서 재검증(2차 방어). recordServiceUsage 영수증 블록 미러 + 참여자 도출만 서버화.
 */
export async function addActivityPhotos(
  usageId: string,
  photos: ActivityPhotoInput[],
): Promise<{ success?: true; added?: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 관리자 둘러보기(view-as) 중에는 사진 업로드를 막는다(읽기전용 미리보기).
  const viewAsBlock = await viewAsWriteBlock()
  if (viewAsBlock) return { error: viewAsBlock }

  if (!photos.length) return { success: true, added: 0 }

  // ★참여자 id 는 usage 에서 서버측 도출(클라 신뢰 금지). RLS 가 접근 가능한 usage 만 반환하므로
  // 권한 없는/없는 usage 면 여기서 걸러진다.
  const { data: usage } = await supabase
    .from('seoul_service_usages')
    .select('participant_id')
    .eq('id', usageId)
    .maybeSingle()
  if (!usage) return { error: '지출 정보를 찾을 수 없어요.' }
  const participantId = usage.participant_id

  const admin = createAdminClient()
  let added = 0
  for (const photo of photos) {
    const contentType = photo.mimeType || 'image/jpeg'
    const ext = MIME_EXT[contentType] || 'jpg'
    // ★경로는 서버가 구성한다 — 첫 세그먼트는 항상 usage 소유 참여자.
    const path = `${participantId}/${usageId}/${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(photo.base64, 'base64')

    const { error: uploadError } = await admin.storage
      .from('activity-photos')
      .upload(path, buffer, { contentType, upsert: true })
    if (uploadError) continue

    const { error: insertError } = await supabase
      .from('seoul_activity_photos')
      .insert({ usage_id: usageId, storage_path: path })
    if (insertError) {
      // 어떤 seoul_activity_photos 행에서도 참조되지 못한 파일을 버킷에 남기지 않는다(orphan 롤백).
      await admin.storage.from('activity-photos').remove([path])
      continue
    }
    added++
  }

  revalidatePath('/gallery')
  revalidatePath('/')
  return { success: true, added }
}
