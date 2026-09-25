'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { viewAsWriteBlock } from '@/utils/supabase/viewAs'
import { friendlyDbError } from '@/utils/supabase/errors'
import { auditLog } from '@/utils/audit'
import { revalidatePath } from 'next/cache'

export interface ServiceUsageInput {
  participantId: string
  allocationId: string
  usageDate: string
  amount: number
  description?: string
  requestedServiceId?: string
  providerId?: string
  /** 분류축(GOAL축B): 이 지출이 속한 지원영역(대분류). nullable — 안 고르면 미분류. */
  domainId?: string | null
  /** 중분류(복지부 3단). 서울형은 flat 이라 보통 null. 넘기면 domainId 하위여야 함(복합 FK). */
  subdomainId?: string | null
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

  // 관리자 둘러보기(view-as) 중에는 남의 예산에 지출을 쓰지 못하게 막는다(읽기전용 미리보기).
  const viewAsBlock = await viewAsWriteBlock()
  if (viewAsBlock) return { error: viewAsBlock }

  let decidedBy = input.decidedBy
  if (!decidedBy) {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    // 역할을 못 읽으면 'by_supporter' 로 조용히 넘어가지 않는다 — v_seoul_self_direction(주도성
    // 지표)이 실제 참여자 본인 입력을 지원자 입력으로 잘못 셀 수 있다.
    if (profileError || !profile) return { error: '사용자 정보를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.' }
    decidedBy = profile.role === 'participant' ? 'self' : 'by_supporter'
  }

  const { data: usage, error } = await supabase
    .from('seoul_service_usages')
    .insert({
      participant_id: input.participantId,
      allocation_id: input.allocationId,
      requested_service_id: input.requestedServiceId || null,
      provider_id: input.providerId || null,
      domain_id: input.domainId || null,
      subdomain_id: input.subdomainId || null,
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
      // 방금 올린 파일이 어떤 seoul_receipts 행에서도 참조되지 못한 채 버킷에 남는 것을 막는다.
      await admin.storage.from('receipts').remove([path])
      return { success: true, usageId: usage.id as string, error: `지출은 기록됐지만 영수증 정보 저장에 실패했어요: ${receiptError.message}` }
    }
  }

  revalidatePath('/receipt')
  revalidatePath('/calendar')
  revalidatePath('/gallery')
  revalidatePath('/')
  return { success: true, usageId: usage.id as string }
}

/**
 * 기존 지출에 영수증 첨부(교체) — recordServiceUsage 는 '신규 지출 insert' 시에만 영수증을 붙일 수
 * 있어, 이미 기록된 지출(영수증 검토 대기·거래 상세)에 영수증을 뒤늦게 붙일 경로가 없었다. 이 액션이
 * 그 공백을 메운다. usage 당 1장 취급 — 기존 영수증 행이 있으면 교체하고 이전 파일도 정리한다.
 *
 * ★보안: ① participant·provider 는 usage 에서 서버 도출(클라 신뢰 금지, RLS 가 접근 가능한 usage 만
 * 반환) · ② 저장 경로는 서버가 `${participantId}/${usageId}.${ext}` 로 구성(위조 불가) · ③ seoul_receipts
 * insert/delete 는 user 스코프(RLS seoul_receipts_write = 담당 staff 또는 self-pending 이 강제).
 * 스토리지 바이트만 admin 클라이언트. view-as 중에는 차단.
 */
export async function attachReceipt(
  usageId: string,
  receipt: { base64: string; mimeType?: string },
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 관리자 둘러보기(view-as) 중에는 쓰기를 막는다(읽기전용 미리보기).
  const viewAsBlock = await viewAsWriteBlock()
  if (viewAsBlock) return { error: viewAsBlock }

  if (!receipt.base64) return { error: '영수증 사진이 없어요.' }

  const { data: usage } = await supabase
    .from('seoul_service_usages')
    .select('participant_id, provider_id')
    .eq('id', usageId)
    .maybeSingle()
  if (!usage) return { error: '지출 정보를 찾을 수 없어요.' }

  const contentType = receipt.mimeType || 'image/jpeg'
  const ext = MIME_EXT[contentType] || 'jpg'
  const path = `${usage.participant_id}/${usageId}.${ext}`

  // ★권한 게이트를 스토리지보다 먼저 통과시킨다(보안, 검증 지적 반영). seoul_service_usages_select(RLS)
  //   는 self·staff 모두에게 열려 있어 위 usage 는 읽히지만, seoul_receipts_write(RLS)는 '담당 staff
  //   또는 self+pending' 만 허용한다(정산 완료된 자기 지출은 write 불가). 그래서 seoul_receipts 행
  //   INSERT 를 먼저 시도해 이 write 권한을 강제한다 — 실패하면 admin 스토리지를 전혀 건드리지 않는다.
  //   (스토리지를 먼저 만졌다면 self+정산완료 지출의 영수증 원본을 덮어쓰거나 지울 수 있었다.)
  const { data: inserted, error: insertError } = await supabase
    .from('seoul_receipts')
    .insert({ usage_id: usageId, provider_id: usage.provider_id || null, storage_path: path })
    .select('id')
    .single()
  if (insertError || !inserted) {
    return { error: '이 지출에는 영수증을 붙일 수 없어요. (정산이 끝났거나 권한이 없어요.)' }
  }

  // 권한 확인 후에만 스토리지 바이트를 올린다.
  const admin = createAdminClient()
  const buffer = Buffer.from(receipt.base64, 'base64')
  const { error: uploadError } = await admin.storage
    .from('receipts')
    .upload(path, buffer, { contentType, upsert: true })
  if (uploadError) {
    // 방금 넣은 행을 롤백 — 어떤 파일도 가리키지 못하는 dangling 행을 남기지 않는다.
    await supabase.from('seoul_receipts').delete().eq('id', inserted.id)
    return { error: `영수증 저장에 실패했어요: ${uploadError.message}` }
  }

  // usage 당 1장 — 방금 넣은 행(inserted.id) 외의 이전 영수증 행을 정리(교체)하고, 경로가 달라
  // 새 파일과 겹치지 않는 이전 파일만 제거한다. 여기 delete 도 RLS(seoul_receipts_write) 적용.
  const { data: others } = await supabase
    .from('seoul_receipts')
    .select('id, storage_path')
    .eq('usage_id', usageId)
    .neq('id', inserted.id)
  if (others?.length) {
    await supabase.from('seoul_receipts').delete().eq('usage_id', usageId).neq('id', inserted.id)
    const stalePaths = others.map((r) => r.storage_path).filter((p): p is string => !!p && p !== path)
    if (stalePaths.length) await admin.storage.from('receipts').remove(stalePaths)
  }

  revalidatePath('/supporter/review')
  revalidatePath(`/supporter/transactions/${usageId}`)
  return { success: true }
}

/**
 * 지출 수정 — 실무자가 잘못 기록한 지출의 금액·날짜·내용을 고친다(오기 정정).
 *
 * 정책: settlement_status='pending' 일 때만 허용한다. 검토가 끝난 지출
 * (accepted/rejected/recovered)은 액션이 DB 를 건드리지 않고 거부한다 —
 * trg_seoul_flag_criteria 가 AFTER INSERT-only 라 검토 후 편집은 리뷰가 stale 해지고,
 * 정산기록·감사추적을 보호해야 하기 때문. RLS(04:188-205)는 staff 에게 더 관대하지만
 * 앱이 pending-only 로 보수적으로 좁힌다. 금지항목 차단(trg_seoul_check_usage=BEFORE
 * UPDATE)은 편집도 재검증하므로 트리거 에러를 friendlyDbError 로 그대로 전달한다.
 */
export async function updateServiceUsage(
  usageId: string,
  patch: { amount?: number; usageDate?: string; description?: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 관리자 둘러보기(view-as) 중에는 남의 예산에 쓰기를 못하게 막는다(읽기전용 미리보기).
  const viewAsBlock = await viewAsWriteBlock()
  if (viewAsBlock) return { error: viewAsBlock }

  const { data: current } = await supabase
    .from('seoul_service_usages')
    .select('settlement_status, participant_id')
    .eq('id', usageId)
    .maybeSingle()

  if (!current) return { error: '지출을 찾을 수 없어요.' }
  if (current.settlement_status !== 'pending') {
    return { error: '정산 검토가 끝난 지출은 수정할 수 없어요.' }
  }

  // patch 로 넘어온 키만 갱신한다(넘기지 않은 필드는 그대로 둠).
  const fields: { amount?: number; usage_date?: string; description?: string | null } = {}
  if (patch.amount !== undefined) fields.amount = patch.amount
  if (patch.usageDate !== undefined) fields.usage_date = patch.usageDate
  if (patch.description !== undefined) fields.description = patch.description || null

  const { error } = await supabase
    .from('seoul_service_usages')
    .update(fields)
    .eq('id', usageId)

  if (error) return { error: friendlyDbError(error) }

  await auditLog(supabase, 'usage.update', {
    targetType: 'service_usage',
    targetId: usageId,
    metadata: fields,
  })

  revalidatePath('/supporter/transactions')
  revalidatePath(`/supporter/transactions/${usageId}`)
  return { success: true }
}

/**
 * 지출 삭제 — pending 지출만 삭제할 수 있다(updateServiceUsage 와 동일 가드).
 * 금전 삭제라 auditLog 로 감사추적을 남긴다(대상 참여자 id 만, PII 금지).
 */
export async function deleteServiceUsage(usageId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const viewAsBlock = await viewAsWriteBlock()
  if (viewAsBlock) return { error: viewAsBlock }

  const { data: current } = await supabase
    .from('seoul_service_usages')
    .select('settlement_status, participant_id')
    .eq('id', usageId)
    .maybeSingle()

  if (!current) return { error: '지출을 찾을 수 없어요.' }
  if (current.settlement_status !== 'pending') {
    return { error: '정산 검토가 끝난 지출은 삭제할 수 없어요.' }
  }

  const { error } = await supabase
    .from('seoul_service_usages')
    .delete()
    .eq('id', usageId)

  if (error) return { error: friendlyDbError(error) }

  await auditLog(supabase, 'usage.delete', {
    targetType: 'service_usage',
    targetId: usageId,
    metadata: { participantId: current.participant_id },
  })

  revalidatePath('/supporter/transactions')
  return { success: true }
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
  domain_id: string | null
  settlement_status: string
}

/** 참여자 본인 또는 실무자 — RLS 가 실제로 볼 수 있는 범위를 정한다 */
export async function getServiceUsages(participantId?: string): Promise<{ error?: string; usages: ServiceUsageRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', usages: [] }

  let query = supabase
    .from('seoul_service_usages')
    .select('id, participant_id, allocation_id, usage_date, amount, description, requested_service_id, provider_id, domain_id, settlement_status')
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
  // 접속기록(개인정보보호법 §29 안전성확보조치) — 영수증(지출·민감 정보) 파일 접근을 기록.
  // 실패는 auditLog 내부 try/catch 로 격리(감사 손실 < 열람 마비). 행위자는 seoul_audit 이 auth.uid() 로 스탬프.
  await auditLog(supabase, 'receipt.view', { targetType: 'receipt', targetId: usageId, metadata: { bucket: 'receipts' } })
  return { url: data.signedUrl }
}
