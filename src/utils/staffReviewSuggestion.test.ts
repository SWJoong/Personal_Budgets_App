import { describe, it, expect } from 'vitest'
import {
  REVIEW_SYSTEM,
  buildReviewContext,
  parseReviewSuggestions,
  reviewPiiTerms,
} from './staffReviewSuggestion'
import type { ReviewSignal } from './staffReviewSignals'

/**
 * 실무자용 AI 점검 제안 — AI 합성 순수로직 계약 (W 레인). 관리자 QA #6.
 * 설계출처: Plan&Source/goala_staff_review_assistant_W.md §3.
 * 구현 대상: src/utils/staffReviewSuggestion.ts.
 *
 * 배경: 신호(staffReviewSignals)를 컨텍스트로 조립 → callAIDeidentified 로 sonnet 에 보내고 → 방어 파싱.
 *   ★환각가드: AI 가 감지되지 않은 신호(basis)를 지어내면 파싱에서 탈락시킨다(신호 범위 밖 제안 차단).
 *
 * RED 사유: staffReviewSuggestion 모듈이 아직 없다.
 */

const SIGNALS: ReviewSignal[] = [
  { kind: 'budget_ceiling', severity: 'high', label: '월 예산 한도 초과', detail: '이번 달 사용액이 월 한도를 넘었어요.' },
  { kind: 'rulecheck_pending', severity: 'medium', label: '규칙 점검 대기', detail: '점검 2건이 검토 대기예요.' },
]

describe('staffReviewSuggestion — AI 합성 순수로직(#6)', () => {
  it('REVIEW_SYSTEM 은 지어내지 말라는 지시와 JSON 출력 규칙을 담는다', () => {
    expect(REVIEW_SYSTEM).toMatch(/JSON/)
    expect(REVIEW_SYSTEM.length).toBeGreaterThan(30)
  })

  it('buildReviewContext 는 신호 label/detail 을 컨텍스트에 반영한다', () => {
    const ctx = buildReviewContext(SIGNALS, { participantLabel: '이 당사자' })
    expect(ctx).toContain('월 예산 한도 초과')
    expect(ctx).toContain('규칙 점검 대기')
  })

  it('정상 JSON → suggestions 파싱(priority·headline·action·basis)', () => {
    const raw = JSON.stringify({
      suggestions: [
        { priority: 'high', headline: '예산 한도 재점검', action: '계획 조정 또는 영역 재배분을 검토하세요.', basis: 'budget_ceiling' },
      ],
    })
    const { suggestions } = parseReviewSuggestions(raw, { validKinds: ['budget_ceiling', 'rulecheck_pending'] })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({ priority: 'high', basis: 'budget_ceiling' })
    expect(suggestions[0].headline.length).toBeGreaterThan(0)
    expect(suggestions[0].action.length).toBeGreaterThan(0)
  })

  it('코드블록/잡텍스트로 감싸도 파싱한다', () => {
    const raw = '```json\n{"suggestions":[{"priority":"medium","headline":"점검 결정","action":"승인/반려하세요.","basis":"rulecheck_pending"}]}\n```'
    const { suggestions } = parseReviewSuggestions(raw, { validKinds: ['rulecheck_pending'] })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].basis).toBe('rulecheck_pending')
  })

  it('★환각가드: 감지되지 않은 basis(신호 밖)는 탈락한다', () => {
    const raw = JSON.stringify({
      suggestions: [
        { priority: 'high', headline: '진짜', action: '실재 신호', basis: 'budget_ceiling' },
        { priority: 'high', headline: '환각', action: '없는 신호를 지어냄', basis: 'isolation' }, // 감지 안 됨
      ],
    })
    const { suggestions } = parseReviewSuggestions(raw, { validKinds: ['budget_ceiling'] })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].basis).toBe('budget_ceiling')
  })

  it('priority 가 규격 밖이거나 필드 누락이면 그 항목은 버린다', () => {
    const raw = JSON.stringify({
      suggestions: [
        { priority: 'urgent', headline: 'x', action: 'y', basis: 'budget_ceiling' }, // priority 규격 밖
        { priority: 'low', headline: 'ok', basis: 'budget_ceiling' }, // action 누락
        { priority: 'medium', headline: '좋음', action: '함', basis: 'budget_ceiling' }, // 유효
      ],
    })
    const { suggestions } = parseReviewSuggestions(raw, { validKinds: ['budget_ceiling'] })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].headline).toBe('좋음')
  })

  it('비배열/깨진 JSON → 빈 목록', () => {
    expect(parseReviewSuggestions('그냥 텍스트', { validKinds: ['budget_ceiling'] }).suggestions).toEqual([])
    expect(parseReviewSuggestions('{"suggestions":"x"}', { validKinds: ['budget_ceiling'] }).suggestions).toEqual([])
  })

  it('최대 5개로 자른다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ priority: 'low', headline: `h${i}`, action: `a${i}`, basis: 'budget_ceiling' }))
    const raw = JSON.stringify({ suggestions: many })
    expect(parseReviewSuggestions(raw, { validKinds: ['budget_ceiling'] }).suggestions).toHaveLength(5)
  })

  it('reviewPiiTerms: 이름=person·기관=agency, 빈값·중복 제거', () => {
    const terms = reviewPiiTerms({ participantName: '김지수', agencyNames: ['햇살복지관', null, '햇살복지관', '  '] })
    expect(terms).toContainEqual({ value: '김지수', kind: 'person' })
    expect(terms.filter((t) => t.value === '햇살복지관')).toHaveLength(1)
    expect(terms.some((t) => t.value.trim() === '')).toBe(false)
  })
})
