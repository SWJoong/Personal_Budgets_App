'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'

export interface ServiceUsageInput {
  participantId: string
  allocationId: string
  usageDate: string
  amount: number
  description?: string
  requestedServiceId?: string
  providerId?: string
  decidedBy?: 'self' | 'self_with_support' | 'suggested_accepted' | 'by_supporter'
  /** base64 인코딩(접두어 없이). 넘기면 receipts 버킷에 저장하고 seoul_receipts 행도 만든다. */
  receiptBase64?: string
  receiptMimeType?: string
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

/**
 * 지출 기록 — 당사자 본인 또는 실무자 양쪽이 호출할 수 있다.
 *
 * RLS(04_seoul_rls.sql B-2)가 "본인은 정산 전(pending)까지만" 을 이미 강제하므로
 * 여기서는 로그인 여부만 확인한다. 금지항목 차단(trg_seoul_check_usage)과
 * 계획외지출 플래그(trg_seoul_flag_criteria)는 DB 트리거 담당 — 중복 검사하지
 * 않고 트리거 예외 메시지를 그대로 사용자에게 전달한다(1차 설계 원칙: 금지는
 * 차단, 요건은 사람 판단).
 *
 * decidedBy 를 명시하지 않으면 로그인한 사람의 역할로 자동 추정한다 — 당사자면
 * 'self', 실무자면 'by_supporter'. 매 지출마다 4단계를 직접 고르게 하면 입력
 * 부담이 커진다(설계 결정: PCT_주도성_변화측정_설계_v1.md 참조).
 */
export async function recordServiceUsage(input: ServiceUsageInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  let decidedBy = input.decidedBy
  if (!decidedBy) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    decidedBy = profile?.role === 'participant' ? 'self' : 'by_supporter'
  }

  const { data: usage, error } = await supabase
    .from('seoul_service_usages')
    .insert({
      participant_id: input.participantId,
      allocation_id: input.allocationId,
      requested_service_id: input.requestedServiceId || null,
      provider_id: input.providerId || null,
      usage_date: input.usageDate,
      amount: input.amount,
      description: input.description || null,
      created_by: user.id,
      decided_by: decidedBy,
    })
    .select('id')
    .single()

  if (error || !usage) return { error: friendlyDbError(error, '이미 기록된 지출이에요.') }

  if (input.receiptBase64) {
    const ext = MIME_EXT[input.receiptMimeType || 'image/jpeg'] || 'jpg'
    const path = `${input.participantId}/${usage.id}.${ext}`
    const admin = createAdminClient()
    const buffer = Buffer.from(input.receiptBase64, 'base64')
    const { error: uploadError } = await admin.storage
      .from('receipts')
      .upload(path, buffer, { contentType: input.receiptMimeType || 'image/jpeg', upsert: true })

    if (uploadError) {
      return { success: true, usageId: usage.id as string, error: `지출은 기록됐지만 영수증 저장에 실패했어요: ${uploadError.message}` }
    }

    const { error: receiptError } = await supabase
      .from('seoul_receipts')
      .insert({ usage_id: usage.id, provider_id: input.providerId || null, storage_path: path })

    if (receiptError) {
      return { success: true, usageId: usage.id as string, error: `지출은 기록됐지만 영수증 정보 저장에 실패했어요: ${receiptError.message}` }
    }
  }

  revalidatePath('/receipt')
  revalidatePath('/calendar')
  revalidatePath('/gallery')
  revalidatePath('/')
  return { success: true, usageId: usage.id as string }
}

export interface ServiceUsageRow {
  id: string
  participant_id: string
  allocation_id: string
  usage_date: string
  amount: number
  description: string | null
  requested_service_id: string | null
  provider_id: string | null
  settlement_status: string
}

/** 참여자 본인 또는 실무자 — RLS 가 실제로 볼 수 있는 범위를 정한다 */
export async function getServiceUsages(participantId?: string): Promise<{ error?: string; usages: ServiceUsageRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', usages: [] }

  let query = supabase
    .from('seoul_service_usages')
    .select('id, participant_id, allocation_id, usage_date, amount, description, requested_service_id, provider_id, settlement_status')
    .order('usage_date', { ascending: false })

  if (participantId) query = query.eq('participant_id', participantId)

  const { data, error } = await query
  if (error) return { error: error.message, usages: [] }
  return { usages: (data ?? []) as ServiceUsageRow[] }
}

/** 영수증 이미지 signed URL — receipts 버킷은 private 이라 매번 새로 발급한다(CLAUDE.md Storage 규칙) */
export async function getReceiptSignedUrl(usageId: string): Promise<{ error?: string; url: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', url: null }

  const { data: receipt } = await supabase
    .from('seoul_receipts')
    .select('storage_path')
    .eq('usage_id', usageId)
    .maybeSingle()

  if (!receipt) return { url: null }

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('receipts').createSignedUrl(receipt.storage_path, 3600)
  if (error) return { error: error.message, url: null }
  return { url: data.signedUrl }
}
