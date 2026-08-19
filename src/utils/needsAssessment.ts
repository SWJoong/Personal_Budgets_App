/**
 * 욕구사정(needs_assessment) 순수 로직 — 서버/클라이언트 공용, 테스트 가능.
 *
 * 'use server' 액션 파일은 모든 export 가 async 여야 하므로, 동기 순수 함수는
 * 여기(util)에 둔다. 분류 정합(program↔domain, subdomain↔domain) 자체는
 * supabase/seoul/10_fk_ization.sql 의 복합 FK 가 DB 레벨에서 최종 방어한다.
 */

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
 * 입력 검증 — DB 왕복 전에 필수값·enum 만 거른다. 통과 시 null, 아니면 쉬운 말 메시지.
 */
export function validateNeedsAssessmentInput(input: NeedsAssessmentInput): string | null {
  if (!input.participantId) return '당사자를 선택해 주세요.'
  if (!input.domainId) return '지원 영역(대분류)을 선택해 주세요.'
  const program = input.program ?? 'seoul'
  if (program !== 'seoul' && program !== 'mohw') return '알 수 없는 제도 구분이에요.'
  return null
}
