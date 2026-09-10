'use server'

import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { revalidatePath } from 'next/cache'
import {
  RELATION_CATEGORIES,
  validateNetworkEntityInput,
  type NetworkEntityInput,
  type RelationCategory,
} from '@/utils/networkEntity'

// RelationCategory / NetworkEntityInput / validateNetworkEntityInput 는 순수 로직이라
// util 로 분리했다('use server' 파일은 모든 export 가 async 여야 한다).

/**
 * 당사자 사회 관계망 CRUD (Track B).
 *
 * 스펙: Plan&Source/goala_relationship_network_crud_W.md §2 B2 · DB: supabase/seoul/13.
 * 관계망(친밀도 1~4·고립 신호)은 사정성 정보라 RLS(13)가 실무자 전용으로 제한한다.
 * 여기서 assertStaff() 로 먼저 걸러 당사자에게는 원문 RLS 에러 대신 쉬운 말을 주고,
 * update/delete 는 .maybeSingle() 의 0행(RLS 로 못 보는 행)을 권한없음 메시지로 다룬다.
 */

export interface NetworkEntityRow {
  id: string
  participant_id: string
  relation_category: RelationCategory
  entity_name: string
  relation_type: string | null
  closeness: number | null
  contact_frequency: string | null
  last_contact_date: string | null
  linked_profile_id: string | null
  created_at: string
}

/** 관계망 항목 생성 — 실무자 전용. created_by 는 현재 로그인 실무자로 기록한다. */
export async function createNetworkEntity(input: NetworkEntityInput) {
  try {
    const { supabase, user } = await assertStaff()

    const invalid = validateNetworkEntityInput(input)
    if (invalid) return { error: invalid }

    const { data, error } = await supabase
      .from('seoul_network_entities')
      .insert({
        participant_id: input.participantId,
        relation_category: input.relationCategory,
        entity_name: input.entityName.trim(),
        relation_type: input.relationType?.trim() || null,
        closeness: input.closeness ?? null,
        contact_frequency: input.contactFrequency || null,
        last_contact_date: input.lastContactDate || null,
        linked_profile_id: input.linkedProfileId || null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error || !data) return { error: `관계망 저장 실패: ${friendlyDbError(error)}` }

    revalidatePath(`/supporter/${input.participantId}/network`)
    return { success: true, id: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 관계망 항목 수정 — 실무자 전용. 담당이 아니면 RLS 로 0행 → 권한 메시지. */
export async function updateNetworkEntity(
  id: string,
  patch: {
    relationCategory?: RelationCategory
    entityName?: string
    relationType?: string
    closeness?: number | null
    contactFrequency?: string
    lastContactDate?: string | null
    linkedProfileId?: string | null
  }
) {
  try {
    const { supabase } = await assertStaff()

    if (patch.relationCategory !== undefined && !RELATION_CATEGORIES.includes(patch.relationCategory)) {
      return { error: '관계 구분(가족·친구·유급지원·지역사회)을 선택해 주세요.' }
    }
    if (patch.closeness != null && (patch.closeness < 1 || patch.closeness > 4)) {
      return { error: '친밀도는 1~4 사이로 입력해 주세요.' }
    }

    const fields: {
      relation_category?: RelationCategory
      entity_name?: string
      relation_type?: string | null
      closeness?: number | null
      contact_frequency?: string | null
      last_contact_date?: string | null
      linked_profile_id?: string | null
    } = {}
    if (patch.relationCategory !== undefined) fields.relation_category = patch.relationCategory
    if (patch.entityName !== undefined) fields.entity_name = patch.entityName.trim()
    if (patch.relationType !== undefined) fields.relation_type = patch.relationType?.trim() || null
    if (patch.closeness !== undefined) fields.closeness = patch.closeness ?? null
    if (patch.contactFrequency !== undefined) fields.contact_frequency = patch.contactFrequency || null
    if (patch.lastContactDate !== undefined) fields.last_contact_date = patch.lastContactDate || null
    if (patch.linkedProfileId !== undefined) fields.linked_profile_id = patch.linkedProfileId || null

    const { data, error } = await supabase
      .from('seoul_network_entities')
      .update(fields)
      .eq('id', id)
      .select('id, participant_id')
      .maybeSingle()

    if (error) return { error: `관계망 수정 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '수정 권한이 없거나 없는 항목이에요.' }

    revalidatePath(`/supporter/${data.participant_id}/network`)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 관계망 항목 삭제 — 실무자 전용. 담당이 아니면 RLS 로 0행 → 권한 메시지. */
export async function deleteNetworkEntity(id: string) {
  try {
    const { supabase } = await assertStaff()

    const { data, error } = await supabase
      .from('seoul_network_entities')
      .delete()
      .eq('id', id)
      .select('id, participant_id')
      .maybeSingle()

    if (error) return { error: `삭제 실패: ${friendlyDbError(error)}` }
    if (!data) return { error: '삭제 권한이 없거나 없는 항목이에요.' }

    revalidatePath(`/supporter/${data.participant_id}/network`)
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/** 참여자별 관계망 목록(실무자 뷰). 4분면·친밀도 순으로 정렬한다. */
export async function getNetworkEntities(
  participantId: string
): Promise<{ error?: string; entities: NetworkEntityRow[] }> {
  try {
    const { supabase } = await assertStaff()
    const { data, error } = await supabase
      .from('seoul_network_entities')
      .select(
        'id, participant_id, relation_category, entity_name, relation_type, closeness, contact_frequency, last_contact_date, linked_profile_id, created_at'
      )
      .eq('participant_id', participantId)
      .order('relation_category')
      .order('closeness', { ascending: true, nullsFirst: false })

    if (error) return { error: error.message, entities: [] }
    return { entities: data ?? [] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.', entities: [] }
  }
}
