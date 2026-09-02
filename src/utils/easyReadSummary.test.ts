import { describe, it, expect } from 'vitest'
import { EASY_READ_SYSTEM, buildSummarySource, summaryPiiTerms } from '@/utils/easyReadSummary'

/**
 * 쉬운말 요약 순수 로직 골든 — W 계약(★U 대행 작성: W 세션 미도달, 실제 W 복귀 시 재검증 요망).
 * 설계: Plan&Source/goala_ai_client_W.md §3.
 * 액션(src/app/actions/easyReadSummary.ts)이 이 조립·terms 를 그대로 써서 callAIDeidentified 로 보낸다.
 * 가명처리 게이트 준수(액션의 직접 callAI 금지)는 aiGateBoundary.test.ts 가 별도로 강제한다.
 */

describe('buildSummarySource — 요약 원문 조립', () => {
  it('빈 입력 → 빈 문자열', () => {
    expect(buildSummarySource({})).toBe('')
    expect(buildSummarySource({ narrative: {}, requestedServices: [], budgetLines: [] })).toBe('')
  })

  it('자기서술 5항목을 라벨과 함께 넣고, 빈·공백 항목은 건너뛴다', () => {
    const out = buildSummarySource({
      narrative: {
        strengthsTalents: '그림 그리기를 잘해요',
        socialBarriers: '혼자 버스 타기가 어려워요',
        desiredChange: '',
        desiredLife: null,
        goalToTry: '수영을 배우고 싶어요',
      },
    })
    expect(out).toContain('나의 상황:')
    expect(out).toContain('- 잘하는 것·좋아하는 것: 그림 그리기를 잘해요')
    expect(out).toContain('- 어려운 점: 혼자 버스 타기가 어려워요')
    expect(out).toContain('- 해보고 싶은 것: 수영을 배우고 싶어요')
    // 빈/누락 항목은 라벨도 나오지 않는다.
    expect(out).not.toContain('바꾸고 싶은 것')
    expect(out).not.toContain('바라는 생활')
  })

  it('요청 서비스를 우선순위 순으로 넣고 예상 금액을 원화로 포맷한다', () => {
    const out = buildSummarySource({
      requestedServices: [
        { serviceName: '미술 수업', priority: 2, estimatedCost: 120000 },
        { serviceName: '활동 지원', priority: 1 },
      ],
    })
    expect(out).toContain('받고 싶은 도움:')
    // priority 1(활동 지원)이 먼저.
    expect(out.indexOf('- 활동 지원')).toBeLessThan(out.indexOf('- 미술 수업'))
    expect(out).toContain('- 미술 수업 (예상 120,000원)')
    // 금액 없는 서비스는 괄호를 붙이지 않는다.
    expect(out).toContain('- 활동 지원\n')
  })

  it('예산 라인을 남은 돈으로 넣는다(천단위 콤마)', () => {
    const out = buildSummarySource({ budgetLines: [{ domainLabel: '일상생활', remaining: 1234567 }] })
    expect(out).toContain('예산:')
    expect(out).toContain('- 일상생활: 남은 돈 1,234,567원')
  })

  it('여러 섹션을 기간→나의 상황→받고 싶은 도움→예산 순서로 합친다', () => {
    const out = buildSummarySource({
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      narrative: { strengthsTalents: '노래를 좋아해요' },
      requestedServices: [{ serviceName: '음악 활동' }],
      budgetLines: [{ domainLabel: '여가', remaining: 50000 }],
    })
    const iPeriod = out.indexOf('계획 기간')
    const iNar = out.indexOf('나의 상황')
    const iSvc = out.indexOf('받고 싶은 도움')
    const iBudget = out.indexOf('예산:')
    expect(iPeriod).toBeGreaterThanOrEqual(0)
    expect(iPeriod).toBeLessThan(iNar)
    expect(iNar).toBeLessThan(iSvc)
    expect(iSvc).toBeLessThan(iBudget)
  })
})

describe('summaryPiiTerms — 가명처리 terms', () => {
  it('참여자 이름은 person, 기관명은 agency 로 만든다', () => {
    const terms = summaryPiiTerms({ participantName: '김지수', agencyNames: ['햇살복지관'] })
    expect(terms).toContainEqual({ value: '김지수', kind: 'person' })
    expect(terms).toContainEqual({ value: '햇살복지관', kind: 'agency' })
  })

  it('빈 값·공백·중복은 걸러낸다', () => {
    const terms = summaryPiiTerms({
      participantName: '  ',
      agencyNames: ['가나기관', '가나기관', null, undefined, ''],
    })
    expect(terms).toEqual([{ value: '가나기관', kind: 'agency' }])
  })

  it('입력이 없으면 빈 배열', () => {
    expect(summaryPiiTerms({})).toEqual([])
  })
})

describe('EASY_READ_SYSTEM — 쉬운 정보 규칙 프롬프트', () => {
  it('핵심 규칙(쉬운 정보·존댓말·사실 불변)을 담는다', () => {
    expect(EASY_READ_SYSTEM).toContain('쉬운 정보')
    expect(EASY_READ_SYSTEM).toContain('존댓말')
    // 요약이 원문의 금액·날짜를 바꾸지 않도록 강제하는 규칙 포함.
    expect(EASY_READ_SYSTEM).toMatch(/금액.*날짜.*바꾸/)
  })
})
