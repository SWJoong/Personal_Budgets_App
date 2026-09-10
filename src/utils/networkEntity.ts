/**
 * 사회 관계망(network entity) 순수 로직 — 서버/클라이언트 공용, 테스트 가능.
 *
 * 'use server' 액션 파일은 모든 export 가 async 여야 하므로, 동기 순수 함수는
 * 여기(util)에 둔다(needsAssessment 관습). 4분면(relation_category)·이름 필수·
 * closeness 1~4 를 DB 왕복 전에 못박아 나쁜 입력을 거른다.
 * DB 레벨 최종 방어는 supabase/seoul/13_network_entities.sql 의 CHECK 제약.
 */

/** 사회 관계망 4분면 — 고립 신호 판독용(pcp_ontology.rdf NetworkEntity). */
export type RelationCategory = 'family' | 'friend' | 'paid_support' | 'community'

export const RELATION_CATEGORIES: RelationCategory[] = ['family', 'friend', 'paid_support', 'community']

export interface NetworkEntityInput {
  participantId: string
  relationCategory: RelationCategory
  entityName: string
  relationType?: string
  closeness?: number | null
  contactFrequency?: string
  lastContactDate?: string | null
  linkedProfileId?: string | null
}

/**
 * 입력 검증 — DB 왕복 전에 필수값·enum·범위만 거른다. 통과 시 null, 아니면 쉬운 말 메시지.
 * closeness 는 선택 필드라 null/미지정은 허용하고, 값이 있으면 1~4 만 받는다.
 */
export function validateNetworkEntityInput(input: Partial<NetworkEntityInput>): string | null {
  if (!input.participantId) return '당사자를 선택해 주세요.'
  if (!input.entityName || !input.entityName.trim()) return '이름을 입력해 주세요.'
  if (!input.relationCategory || !RELATION_CATEGORIES.includes(input.relationCategory)) {
    return '관계 구분(가족·친구·유급지원·지역사회)을 선택해 주세요.'
  }
  if (input.closeness != null && (input.closeness < 1 || input.closeness > 4)) {
    return '친밀도는 1~4 사이로 입력해 주세요.'
  }
  return null
}
