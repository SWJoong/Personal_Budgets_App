'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { extractStoragePath } from '@/utils/supabase/storage'

const SIGNED_URL_EXPIRES = 3600 // 1시간

/**
 * 트랜잭션 목록의 영수증·활동사진 URL을 signed URL로 일괄 변환합니다.
 * receipts, activity-photos 버킷이 private(public=false)일 때 사용합니다.
 *
 * @param items - { id, receiptUrl, activityUrl } 배열
 * @returns id → { receipt?, activity? } 매핑
 */
export async function getSignedImageUrls(
  items: { id: string; receiptUrl: string | null; activityUrl: string | null }[]
): Promise<Record<string, { receipt?: string; activity?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const admin = createAdminClient()
  const result: Record<string, { receipt?: string; activity?: string }> = {}

  // 서명 URL 생성 요청을 bucket별로 분류
  const receiptPaths: { id: string; path: string }[] = []
  const activityPaths: { id: string; path: string }[] = []

  for (const item of items) {
    if (item.receiptUrl) {
      const path = extractStoragePath(item.receiptUrl, 'receipts')
      if (path) receiptPaths.push({ id: item.id, path })
    }
    if (item.activityUrl) {
      const path = extractStoragePath(item.activityUrl, 'activity-photos')
      if (path) activityPaths.push({ id: item.id, path })
    }
  }

  // receipts 버킷 signed URLs 일괄 생성
  if (receiptPaths.length > 0) {
    const { data } = await admin.storage
      .from('receipts')
      .createSignedUrls(receiptPaths.map(p => p.path), SIGNED_URL_EXPIRES)
    if (data) {
      data.forEach((item, idx) => {
        if (item.signedUrl) {
          const id = receiptPaths[idx].id
          result[id] = { ...result[id], receipt: item.signedUrl }
        }
      })
    }
  }

  // activity-photos 버킷 signed URLs 일괄 생성
  if (activityPaths.length > 0) {
    const { data } = await admin.storage
      .from('activity-photos')
      .createSignedUrls(activityPaths.map(p => p.path), SIGNED_URL_EXPIRES)
    if (data) {
      data.forEach((item, idx) => {
        if (item.signedUrl) {
          const id = activityPaths[idx].id
          result[id] = { ...result[id], activity: item.signedUrl }
        }
      })
    }
  }

  return result
}

/**
 * 단일 이미지 URL을 signed URL로 변환합니다.
 * 거래 상세 화면 등 단건 조회 시 사용합니다.
 */
export async function getSignedImageUrl(
  url: string | null,
  bucket: 'receipts' | 'activity-photos'
): Promise<string | null> {
  if (!url) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const path = extractStoragePath(url, bucket)
  if (!path) return null

  const admin = createAdminClient()
  const { data } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRES)

  return data?.signedUrl ?? null
}
