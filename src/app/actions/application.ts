'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'

export interface ApplicationInput {
  participantId: string
  cohortId: string
  receiptNumber?: string
  applicationDate?: string
  receivedById?: string
  proxyId?: string
}

/**
 * 신청서 등록 (실무자 전용)
 *
 * 참여자는 신청서를 직접 입력하지 않는다 — 접수번호·서명 등 행정 기록이라
 * seoul_applications 는 실무자만 쓸 수 있다(supabase/seoul/04_seoul_rls.sql 그룹 A).
 */
export async function createApplication(input: ApplicationInput) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_applications')
      .insert({
        participant_id: input.participantId,
        cohort_id: input.cohortId,
        receipt_number: input.receiptNumber || null,
        application_date: input.applicationDate || undefined,
        received_by_id: input.receivedById || null,
        proxy_id: input.proxyId || null,
      })
      .select('id')
      .single()

    if (error || !data) {
      return { error: `신청서 등록 실패: ${friendlyDbError(error, '이 차수에 이미 신청한 사람이에요.')}` }
    }

    revalidatePath('/supporter/applications')
    return { success: true, applicationId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export async function getApplications(cohortId?: string) {
  try {
    const { supabase } = await assertStaff()

    let query = supabase
      .from('seoul_applications')
      .select('id, participant_id, cohort_id, receipt_number, application_date, status')
      .order('application_date', { ascending: false })

    if (cohortId) query = query.eq('cohort_id', cohortId)

    const { data, error } = await query
    if (error) return { error: error.message, applications: [] }
    return { applications: data ?? [] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.', applications: [] }
  }
}

export type ApplicationStatus = 'draft' | 'received' | 'screening' | 'selected' | 'not_selected' | 'withdrawn'

export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_applications')
      .update({ status })
      .eq('id', applicationId)
      .select('id')
      .maybeSingle()

    if (error) return { error: `상태 변경 실패: ${friendlyDbError(error)}` }
    // assertStaff() 는 "실무자인지"만 확인한다 — 이 신청서의 담당자인지는 RLS(seoul_is_staff_for)가
    // 따로 본다. 담당이 아니면 에러 없이 조용히 0행이 되므로, 행이 실제로 돌아왔는지 확인해야
    // "됐다고 나왔는데 실제로는 안 됐다"를 막을 수 있다.
    if (!data) return { error: '이 신청서를 수정할 권한이 없거나 존재하지 않아요.' }

    revalidatePath('/supporter/applications')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export type PublicAssistance = 'basic_livelihood' | 'near_poor' | 'none'

export interface BenefitStatusInput {
  participantId: string
  publicAssistance: PublicAssistance
  usesActivitySupport?: boolean
  usesSeoulAdditionalSupport?: boolean
  participatesInMohwPilot?: boolean
}

/**
 * 공공부조 수급현황 기록 (실무자 전용) — 신청서 §신청자 정보의 항목이다.
 *
 * 이 값이 본인부담금 면제 판정의 유일한 입력이다. 3차(2026) 안내문:
 * "기초생활수급자·차상위계층 본인부담금 없음(0원) / 그 외 지원액의 10%(최대 24만 원)".
 * 배정이 만들어질 때 seoul_set_copay() 트리거가 이 표를 읽어 면제 여부를 정하므로,
 * 심의 승인 전에 기록해 두어야 한다. 없으면 배정이 'unverified' 로 남고 화면이
 * "확인 전"임을 알린다 — 조용히 면제 처리하거나 조용히 부과하지 않는다.
 */
export async function recordBenefitStatus(input: BenefitStatusInput) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_benefit_status')
      .upsert(
        {
          participant_id: input.participantId,
          public_assistance: input.publicAssistance,
          uses_activity_support: input.usesActivitySupport ?? false,
          uses_seoul_additional_support: input.usesSeoulAdditionalSupport ?? false,
          participates_in_mohw_pilot: input.participatesInMohwPilot ?? false,
        },
        { onConflict: 'participant_id' }
      )
      .select('id')
      .maybeSingle()

    if (error) return { error: `수급현황 기록 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '이 당사자의 정보를 수정할 권한이 없거나 존재하지 않아요.' }

    revalidatePath('/supporter/applications')
    revalidatePath('/admin/participants')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 수급현황 조회 — 없으면 null (아직 안 받은 상태와 'none' 을 구분해야 한다) */
export async function getBenefitStatus(participantId: string) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_benefit_status')
      .select('public_assistance, uses_activity_support, uses_seoul_additional_support, participates_in_mohw_pilot')
      .eq('participant_id', participantId)
      .maybeSingle()

    if (error) return { error: error.message, benefitStatus: null }
    return { benefitStatus: data }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.', benefitStatus: null }
  }
}

export interface ConsentInput {
  applicationId: string
  participantId: string
  consentType: 'general' | 'unique_id'
  isAgreed: boolean
  signedByProxy?: boolean
}

/** 동의 기록 (실무자 전용) — 같은 신청서·동의 종류는 upsert */
export async function recordConsent(input: ConsentInput) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_consent_records')
      .upsert(
        {
          application_id: input.applicationId,
          participant_id: input.participantId,
          consent_type: input.consentType,
          is_agreed: input.isAgreed,
          signed_by_proxy: input.signedByProxy ?? false,
          withdrawn_at: null,
        },
        { onConflict: 'application_id,consent_type' }
      )
      .select('id')
      .maybeSingle()

    if (error) return { error: `동의 기록 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '이 신청서를 수정할 권한이 없거나 존재하지 않아요.' }

    revalidatePath('/supporter/applications')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 동의 철회 (개인정보보호법상 철회권) — is_agreed 는 그대로 두고 withdrawn_at 만 남긴다 */
export async function withdrawConsent(consentId: string) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_consent_records')
      .update({ withdrawn_at: new Date().toISOString() })
      .eq('id', consentId)
      .select('id')
      .maybeSingle()

    if (error) return { error: `동의 철회 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '이 동의 기록을 수정할 권한이 없거나 존재하지 않아요.' }

    revalidatePath('/supporter/applications')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export async function getConsentRecords(applicationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', consents: [] }

  const { data, error } = await supabase
    .from('seoul_consent_records')
    .select('*')
    .eq('application_id', applicationId)

  if (error) return { error: error.message, consents: [] }
  return { consents: data ?? [] }
}

export type ApplicationDocType = 'application_form' | 'consent_form' | 'other'

export interface ApplicationDocumentRow {
  id: string
  doc_type: string
  file_name: string
  note: string | null
  created_at: string
}

const DOC_MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'application/haansofthwp': 'hwp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

/**
 * 신청서·동의서 원본 보관 (실무자 전용)
 *
 * 서식의 문항을 앱에 옮겨 담지 않고 원본 파일만 저장한다 — 법정 서식은 임의로
 * 바꿀 수 없고 차수마다 달라지므로, 칸을 복제하면 서식이 바뀔 때마다 스키마가
 * 따라 움직여야 하고 옮기는 과정에서 원본과 달라질 위험이 생긴다(기관 확인).
 *
 * 경로는 '{participantId}/applications/...' 로 둔다 — 06_storage.sql 의
 * seoul_storage_owner() 가 첫 세그먼트로 소유자를 판별하므로 이 규칙을 어기면
 * 접근 제어가 깨진다.
 */
export async function uploadApplicationDocument(input: {
  applicationId: string
  participantId: string
  docType: ApplicationDocType
  fileName: string
  base64: string
  mimeType?: string
  note?: string
}) {
  try {
    const { supabase, user } = await assertStaff()

    const ext = DOC_MIME_EXT[input.mimeType || ''] || input.fileName.split('.').pop() || 'bin'
    const path = `${input.participantId}/applications/${input.applicationId}/${crypto.randomUUID()}.${ext}`

    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(path, Buffer.from(input.base64, 'base64'), {
        contentType: input.mimeType || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) return { error: `파일 저장 실패: ${uploadError.message}` }

    const { data, error } = await supabase
      .from('seoul_application_documents')
      .insert({
        application_id: input.applicationId,
        participant_id: input.participantId,
        doc_type: input.docType,
        file_name: input.fileName,
        storage_path: path,
        note: input.note?.trim() || null,
        uploaded_by: user.id,
      })
      .select('id')
      .maybeSingle()

    if (error || !data) {
      // 어떤 행에서도 참조되지 않는 파일이 버킷에 남는 것을 막는다.
      await admin.storage.from('documents').remove([path])
      return { error: `서류 기록 실패: ${friendlyDbError(error)}` }
    }

    revalidatePath(`/supporter/applications/${input.applicationId}`)
    return { success: true, documentId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 신청서에 붙은 원본 서류 목록 — 본인도 볼 수 있다(RLS 가 범위를 정한다) */
export async function getApplicationDocuments(
  applicationId: string
): Promise<{ error?: string; documents: ApplicationDocumentRow[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', documents: [] }

  const { data, error } = await supabase
    .from('seoul_application_documents')
    .select('id, doc_type, file_name, note, created_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, documents: [] }
  return { documents: (data ?? []) as ApplicationDocumentRow[] }
}

/** 원본 서류 열람용 signed URL — documents 버킷은 private (CLAUDE.md Storage 규칙) */
export async function getApplicationDocumentUrl(documentId: string): Promise<{ error?: string; url: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', url: null }

  // RLS 가 볼 수 있는 행만 돌려주므로, 여기서 조회되면 열람 권한이 있는 것이다.
  const { data: doc } = await supabase
    .from('seoul_application_documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle()

  if (!doc) return { error: '볼 수 없는 서류예요.', url: null }

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('documents').createSignedUrl(doc.storage_path, 3600)
  if (error) return { error: error.message, url: null }
  return { url: data.signedUrl }
}
