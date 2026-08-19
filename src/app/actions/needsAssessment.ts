'use server'

import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'

/**
 * 지원영역 욕구사정 (GOAL축 B).
 *
 * 스펙: Plan&Source/ontology_db_reform_spec_W.md §3 · DB: supabase/seoul/09·10.
 * 사정(needs_assessment)은 분류축(사정→목표→예산→지출→평가)의 시작점이며,
 * 수행기관 담당자(실무자)가 작성한다 — RLS(09)도 쓰기를 담당자로 제한하지만,
 * 여기서 assertStaff() 로 먼저 걸러 당사자에게는 원문 RLS 에러 대신 쉬운 말을 준다.
 * 분류 정합(program↔domain, subdomain↔domain)은 10 의 복합 FK 가 DB 레벨에서 방어한다.
 */

// ── 분류 참조 데이터 (욕구사정 폼의 대분류/중분류 선택지) ──────────────────

/** 대분류 — program 별(서울형 6 / 복지부 8). */
export async function getServiceDomains(program: 'seoul' | 'mohw' = 'seoul') {
  try {
    const { supabase } = await assertStaff()
    const { data, error } = await supabase
      .from('seoul_service_domains')
      .select('id, program, code, label, sort_order')
      .eq('program', program)
      .order('sort_order', { ascending: true })

    if (error) return { error: error.message, domains: [] }
    return { domains: data ?? [] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.', domains: [] }
  }
}

/** 중분류 — 대분류 하나에 속하는 것들(복지부만 존재, 서울형은 flat 이라 0개). */
export async function getServiceSubdomains(domainId: string) {
  try {
    const { supabase } = await assertStaff()
    const { data, error } = await supabase
      .from('seoul_service_subdomains')
      .select('id, domain_id, code, label, examples, sort_order')
      .eq('domain_id', domainId)
      .order('sort_order', { ascending: true })

    if (error) return { error: error.message, subdomains: [] }
    return { subdomains: data ?? [] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.', subdomains: [] }
  }
}

// ── 욕구사정 조회 ────────────────────────────────────────────────────────

/** 참여자별 욕구사정 목록(실무자 뷰). 라벨은 화면에서 분류 참조로 붙인다. */
export async function getNeedsAssessments(participantId: string) {
  try {
    const { supabase } = await assertStaff()
    const { data, error } = await supabase
      .from('seoul_needs_assessment')
      .select(
        'id, participant_id, program, domain_id, subdomain_id, support_example, limitation, need_hope, assessed_by, created_at'
      )
      .eq('participant_id', participantId)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message, assessments: [] }
    return { assessments: data ?? [] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.', assessments: [] }
  }
}

// ── 생성·수정·삭제 ───────────────────────────────────────────────────────

export interface NeedsAssessmentInput {
  participantId: string
  program?: 'seoul' | 'mohw'
  domainId: string
  subdomainId?: string | null
  supportExample?: string
  limitation?: string
  needHope?: string
}

/**
 * 입력 검증(순수 함수) — DB 왕복 전에 거른다. 통과 시 null, 아니면 쉬운 말 메시지.
 * (분류 정합 자체는 DB 복합 FK 가 최종 방어하므로 여기선 필수값·enum 만 본다.)
 */
export function validateNeedsAssessmentInput(input: NeedsAssessmentInput): string | null {
  if (!input.participantId) return '당사자를 선택해 주세요.'
  if (!input.domainId) return '지원 영역(대분류)을 선택해 주세요.'
  const program = input.program ?? 'seoul'
  if (program !== 'seoul' && program !== 'mohw') return '알 수 없는 제도 구분이에요.'
  return null
}

/** 욕구사정 생성 — 담당자 전용. assessed_by 는 현재 로그인 담당자로 기록한다. */
export async function createNeedsAssessment(input: NeedsAssessmentInput) {
  try {
    const { supabase, user } = await assertStaff()

    const invalid = validateNeedsAssessmentInput(input)
    if (invalid) return { error: invalid }

    const { data, error } = await supabase
      .from('seoul_needs_assessment')
      .insert({
        participant_id: input.participantId,
        program: input.program ?? 'seoul',
        domain_id: input.domainId,
        subdomain_id: input.subdomainId || null,
        support_example: input.supportExample || null,
        limitation: input.limitation || null,
        need_hope: input.needHope || null,
        assessed_by: user.id,
      })
      .select('id')
      .single()

    if (error || !data) return { error: `욕구사정 저장 실패: ${friendlyDbError(error)}` }

    revalidatePath('/supporter/plans')
    revalidatePath(`/supporter/${input.participantId}`)
    return { success: true, id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 욕구사정 수정 — 담당자 전용. 담당이 아니면 RLS 로 0행 → 권한 메시지. */
export async function updateNeedsAssessment(
  id: string,
  input: Partial<Pick<NeedsAssessmentInput, 'domainId' | 'subdomainId' | 'supportExample' | 'limitation' | 'needHope'>>
) {
  try {
    const { supabase } = await assertStaff()

    const updateData: {
      domain_id?: string
      subdomain_id?: string | null
      support_example?: string | null
      limitation?: string | null
      need_hope?: string | null
    } = {}
    if (input.domainId !== undefined) updateData.domain_id = input.domainId
    if (input.subdomainId !== undefined) updateData.subdomain_id = input.subdomainId || null
    if (input.supportExample !== undefined) updateData.support_example = input.supportExample || null
    if (input.limitation !== undefined) updateData.limitation = input.limitation || null
    if (input.needHope !== undefined) updateData.need_hope = input.needHope || null

    const { data, error } = await supabase
      .from('seoul_needs_assessment')
      .update(updateData)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return { error: `욕구사정 수정 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '이 욕구사정을 수정할 권한이 없거나 존재하지 않아요.' }

    revalidatePath('/supporter/plans')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 욕구사정 삭제 — 담당자 전용(RLS 는 관리자만 DELETE 허용). */
export async function deleteNeedsAssessment(id: string) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_needs_assessment')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return { error: `삭제 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '삭제할 권한이 없거나 이미 삭제됐어요.' }

    revalidatePath('/supporter/plans')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}
