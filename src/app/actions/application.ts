'use server'

import { createClient } from '@/utils/supabase/server'
import { assertStaff } from '@/utils/supabase/staff'
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

    if (error || !data) return { error: `신청서 등록 실패: ${error?.message}` }

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

    const { error } = await supabase
      .from('seoul_applications')
      .update({ status })
      .eq('id', applicationId)

    if (error) return { error: `상태 변경 실패: ${error.message}` }

    revalidatePath('/supporter/applications')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
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

    const { error } = await supabase
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

    if (error) return { error: `동의 기록 실패: ${error.message}` }

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

    const { error } = await supabase
      .from('seoul_consent_records')
      .update({ withdrawn_at: new Date().toISOString() })
      .eq('id', consentId)

    if (error) return { error: `동의 철회 실패: ${error.message}` }

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
