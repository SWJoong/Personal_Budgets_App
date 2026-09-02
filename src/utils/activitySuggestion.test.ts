import { describe, it, expect } from 'vitest'
import {
  SUGGEST_SYSTEM,
  buildSuggestionContext,
  parseSuggestions,
  suggestionPiiTerms,
} from '@/utils/activitySuggestion'

/**
 * AI 활동 제안 순수 로직 골든 — W 계약(★U 대행 작성: W 세션 미도달, 실제 W 복귀 시 재검증 요망).
 * 설계: Plan&Source/goala_ai_client_W.md §4.
 * 액션(src/app/actions/activitySuggestion.ts)이 이 조립·파싱·terms 를 써서 callAIDeidentified(json) 로 보낸다.
 * 가명처리 게이트 준수(직접 callAI 금지)는 aiGateBoundary.test.ts 가 별도로 강제한다.
 */

describe('buildSuggestionContext — 제안 컨텍스트 조립', () => {
  it('남은 돈이 있는 영역만 넣고, 제공기관을 덧붙이며, 남은 돈을 원화로 포맷한다', () => {
    const out = buildSuggestionContext({
      domains: [
        { domainId: 'd1', domainLabel: '여가', remaining: 150000, providerNames: ['햇살문화센터'] },
        { domainId: 'd2', domainLabel: '건강', remaining: 0 },
        { domainId: 'd3', domainLabel: '사회생활', remaining: -5000 },
      ],
    })
    expect(out).toContain('- 여가(id:d1): 남은 돈 150,000원 / 가까운 곳: 햇살문화센터')
    // remaining 0·음수 영역은 제외.
    expect(out).not.toContain('건강')
    expect(out).not.toContain('사회생활')
  })

  it('남은 예산 영역이 하나도 없으면 그 사실을 명시한다', () => {
    const out = buildSuggestionContext({ domains: [{ domainId: 'd1', domainLabel: '여가', remaining: 0 }] })
    expect(out).toContain('남은 예산이 있는 영역이 없어요')
  })

  it('관심·이력이 있으면 덧붙인다', () => {
    const out = buildSuggestionContext({
      domains: [{ domainId: 'd1', domainLabel: '여가', remaining: 10000 }],
      interests: '음악을 좋아해요',
    })
    expect(out).toContain('관심·이력: 음악을 좋아해요')
  })
})

describe('parseSuggestions — AI JSON 방어 파싱', () => {
  const good =
    '{"suggestions":[{"title":"수영 배우기","domain_id":"d1","why":"물을 좋아해요","est_cost":30000}]}'

  it('정상 JSON → camelCase 로 정규화', () => {
    const { suggestions } = parseSuggestions(good)
    expect(suggestions).toEqual([
      { title: '수영 배우기', domainId: 'd1', why: '물을 좋아해요', estCost: 30000 },
    ])
  })

  it('코드블록·앞뒤 잡텍스트가 있어도 JSON 을 뽑아 파싱한다', () => {
    const raw = '좋아요! 아래를 참고하세요.\n```json\n' + good + '\n```'
    expect(parseSuggestions(raw).suggestions).toHaveLength(1)
  })

  it('깨진 JSON·비객체·suggestions 비배열 → 빈 목록(throw 안 함)', () => {
    expect(parseSuggestions('죄송해요, 만들지 못했어요').suggestions).toEqual([])
    expect(parseSuggestions('{"suggestions": "not-array"}').suggestions).toEqual([])
    expect(parseSuggestions('{"nope": 1}').suggestions).toEqual([])
    expect(parseSuggestions('').suggestions).toEqual([])
  })

  it('필수 필드(title·domain_id·why)가 빠진 항목은 버린다', () => {
    const raw =
      '{"suggestions":[{"title":"제목만","domain_id":"d1"},{"title":"온전","domain_id":"d1","why":"이유"}]}'
    const { suggestions } = parseSuggestions(raw)
    expect(suggestions).toEqual([{ title: '온전', domainId: 'd1', why: '이유' }])
  })

  it('validDomainIds 를 주면 그 안의 영역만 통과(환각 domain 차단)', () => {
    const raw =
      '{"suggestions":[{"title":"A","domain_id":"d1","why":"x"},{"title":"B","domain_id":"ZZZ","why":"y"}]}'
    const { suggestions } = parseSuggestions(raw, { validDomainIds: ['d1', 'd2'] })
    expect(suggestions.map((s) => s.title)).toEqual(['A'])
  })

  it('최대 3개로 자른다', () => {
    const items = Array.from({ length: 5 }, (_, i) => `{"title":"t${i}","domain_id":"d1","why":"w"}`)
    const raw = `{"suggestions":[${items.join(',')}]}`
    expect(parseSuggestions(raw).suggestions).toHaveLength(3)
  })

  it('est_cost 가 음수·비숫자면 금액 없이 통과시킨다', () => {
    const raw =
      '{"suggestions":[{"title":"A","domain_id":"d1","why":"x","est_cost":-100},{"title":"B","domain_id":"d1","why":"y","est_cost":"공짜"}]}'
    const { suggestions } = parseSuggestions(raw)
    expect(suggestions).toEqual([
      { title: 'A', domainId: 'd1', why: 'x' },
      { title: 'B', domainId: 'd1', why: 'y' },
    ])
  })
})

describe('suggestionPiiTerms — 가명처리 terms', () => {
  it('이름=person, 제공기관=agency, 빈·중복 제거', () => {
    const terms = suggestionPiiTerms({
      participantName: '김지수',
      providerNames: ['햇살센터', '햇살센터', '', null],
    })
    expect(terms).toEqual([
      { value: '김지수', kind: 'person' },
      { value: '햇살센터', kind: 'agency' },
    ])
  })
})

describe('SUGGEST_SYSTEM — 활동 제안 프롬프트', () => {
  it('쉬운 말·1~3개·JSON 스키마(suggestions·domain_id)를 담는다', () => {
    expect(SUGGEST_SYSTEM).toContain('존댓말')
    expect(SUGGEST_SYSTEM).toContain('suggestions')
    expect(SUGGEST_SYSTEM).toContain('domain_id')
    expect(SUGGEST_SYSTEM).toMatch(/1개.*3개/)
  })
})
