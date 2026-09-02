import type { PiiTerm } from '@/utils/deidentify'

/**
 * 쉬운말 요약 — 순수 로직(입력 조립 · PII terms · 시스템 프롬프트). 계약: src/utils/easyReadSummary.test.ts.
 * 설계: Plan&Source/goala_ai_client_W.md §3.
 *
 * 서버 액션(src/app/actions/easyReadSummary.ts)이 이 유틸로 원문을 만들고, 가명처리 게이트
 * callAIDeidentified(원문, terms, {system: EASY_READ_SYSTEM, ...}) 로 보낸다.
 * (액션이 callAI 를 직접 부르는 것은 aiGateBoundary.test.ts 가 금지한다 — 이 유틸은 순수·부수효과 없음.)
 */

/** 쉬운 정보(Easy Read) 시스템 프롬프트 — 규칙 내장(설계 §3). 요약이 사실을 왜곡하지 않도록 금액·날짜 불변 포함. */
export const EASY_READ_SYSTEM = `너는 발달장애 당사자를 위한 '쉬운 정보(Easy Read)' 작성자다. 아래 규칙을 반드시 지켜라.
1) 한 문장에 한 가지 내용만 담고, 짧게 쓴다(한 문장 15어절 이하).
2) 쉬운 낱말만 쓴다. 어려운 말·한자어·전문어는 금지한다. 예: '지출'→'쓴 돈', '잔액'→'남은 돈', '본인부담금'→'내가 낼 돈'.
3) 능동태로 쓴다. 피동('-되다')은 피한다.
4) 숫자는 '원'을 붙여 또렷이 쓴다. 큰 수는 쉽게 풀어 준다.
5) 부정보다 긍정으로 쓴다. 위협하는 말은 쓰지 않는다.
6) 원문의 금액·날짜·사실을 절대 바꾸지 않는다.
7) 존댓말('~요')로 쓴다.`

export interface SummaryNarrative {
  strengthsTalents?: string | null
  socialBarriers?: string | null
  desiredChange?: string | null
  desiredLife?: string | null
  goalToTry?: string | null
}

export interface SummaryRequestedService {
  serviceName: string
  priority?: number | null
  estimatedCost?: number | null
}

export interface SummaryBudgetLine {
  domainLabel: string
  remaining: number
}

export interface SummarySourceInput {
  periodStart?: string | null
  periodEnd?: string | null
  narrative?: SummaryNarrative | null
  requestedServices?: SummaryRequestedService[]
  budgetLines?: SummaryBudgetLine[]
}

/** 자기서술 5항목 — 필드 → 요약 소스용 라벨. */
const NARRATIVE_FIELDS: [keyof SummaryNarrative, string][] = [
  ['strengthsTalents', '잘하는 것·좋아하는 것'],
  ['socialBarriers', '어려운 점'],
  ['desiredChange', '바꾸고 싶은 것'],
  ['desiredLife', '바라는 생활'],
  ['goalToTry', '해보고 싶은 것'],
]

/** 원화 포맷(로케일 비의존, 결정성). 음수도 안전. */
function won(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
}

/**
 * 요약 원문(AI 입력) 조립 — 빈 항목은 건너뛴다. 아무 내용도 없으면 빈 문자열.
 * 순수 함수: 같은 입력 → 같은 출력(결정성). 저장·부수효과 없음.
 * 섹션 순서: 계획 기간 → 나의 상황(자기서술) → 받고 싶은 도움(서비스) → 예산.
 */
export function buildSummarySource(input: SummarySourceInput): string {
  const parts: string[] = []

  if (input.periodStart || input.periodEnd) {
    parts.push(`계획 기간: ${input.periodStart ?? '?'} ~ ${input.periodEnd ?? '?'}`)
  }

  const nar = input.narrative
  if (nar) {
    const lines = NARRATIVE_FIELDS.map(([k, label]) => {
      const v = nar[k]
      return v && v.trim() ? `- ${label}: ${v.trim()}` : null
    }).filter((l): l is string => l !== null)
    if (lines.length) parts.push('나의 상황:\n' + lines.join('\n'))
  }

  const services = input.requestedServices ?? []
  if (services.length) {
    const lines = services
      .slice()
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .map((s) => {
        const cost = typeof s.estimatedCost === 'number' ? ` (예상 ${won(s.estimatedCost)})` : ''
        return `- ${s.serviceName}${cost}`
      })
    parts.push('받고 싶은 도움:\n' + lines.join('\n'))
  }

  const budget = input.budgetLines ?? []
  if (budget.length) {
    const lines = budget.map((b) => `- ${b.domainLabel}: 남은 돈 ${won(b.remaining)}`)
    parts.push('예산:\n' + lines.join('\n'))
  }

  return parts.join('\n\n')
}

/**
 * 가명처리 terms — 참여자 이름(person) · 관련 기관명(agency). deidentify 는 텍스트에 실제 나타나는
 * 값만 토큰화하므로(no-op safe) 등장 여부와 무관하게 넘겨도 안전하다. 빈·공백·중복 값은 걸러 넘긴다.
 */
export function summaryPiiTerms(input: {
  participantName?: string | null
  agencyNames?: (string | null | undefined)[]
}): PiiTerm[] {
  const terms: PiiTerm[] = []
  const seen = new Set<string>()
  const push = (value: string | null | undefined, kind: PiiTerm['kind']) => {
    const v = value?.trim()
    if (!v || seen.has(v)) return
    seen.add(v)
    terms.push({ value: v, kind })
  }
  push(input.participantName, 'person')
  for (const a of input.agencyNames ?? []) push(a, 'agency')
  return terms
}
