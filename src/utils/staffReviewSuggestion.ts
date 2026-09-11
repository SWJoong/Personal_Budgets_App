import type { PiiTerm } from '@/utils/deidentify'
import type { ReviewSignal, ReviewSeverity } from '@/utils/staffReviewSignals'

/**
 * 실무자용 AI 점검 제안 — AI 합성 순수로직(컨텍스트 조립 · 응답 파싱 · 시스템 프롬프트 · PII terms).
 * 계약: src/utils/staffReviewSuggestion.test.ts. 설계: Plan&Source/goala_staff_review_assistant_W.md §3.
 *
 * 서버 액션(src/app/actions/staffReviewSuggestion.ts)이 이 유틸로 컨텍스트를 만들고, 가명처리 게이트
 * callAIDeidentified(컨텍스트, terms, {system: REVIEW_SYSTEM, json:true, ...}) 로 보낸 뒤 parseReviewSuggestions 로 파싱한다.
 * (액션의 직접 callAI 사용은 aiGateBoundary.test.ts 가 금지 — 이 유틸은 순수·부수효과 없음.)
 */

/** 점검 제안 시스템 프롬프트 — ①받은 신호 범위 안에서만 ②우선순위+다음 행동 ③존댓말·간결 ④JSON 하나만(설계 §3). */
export const REVIEW_SYSTEM = `너는 사회복지 실무자(선생님)를 돕는 점검 도우미다. 아래 규칙을 반드시 지켜라.
1) 아래에 준 '감지된 점검 신호' 목록만 근거로 삼는다. 목록에 없는 문제·수치·사실은 절대 지어내지 않는다.
2) 신호를 우선순위(높음·보통·낮음)로 정리하고, 각 항목마다 '다음에 할 일'을 한 문장으로 제시한다.
3) 존댓말로 짧고 쉽게 쓴다.
4) 각 제안의 basis 에는 근거가 된 신호의 kind 를 그대로 쓴다.
출력은 아래 형태의 JSON 하나만 낸다(설명·코드블록 없이):
{"suggestions":[{"priority":"high|medium|low","headline":"짧은 제목","action":"다음에 할 일 한 문장","basis":"신호 kind"}]}`

export interface ReviewSuggestion {
  priority: 'high' | 'medium' | 'low'
  headline: string
  action: string
  /** 근거가 된 신호 kind. 감지된 신호 밖이면 파싱에서 탈락(환각 가드). */
  basis: string
}

const SEV_LABEL: Record<ReviewSeverity, string> = { high: '높음', medium: '보통', info: '참고' }

/**
 * AI 입력 컨텍스트 조립 — 신호 목록을 텍스트로. 이름·기관은 넣지 않는다(당사자 라벨로 충분·설계 §3).
 * 순수 함수(결정성). 신호가 없으면 그 사실을 명시한다(액션은 신호 0 이면 이 함수 전에 반환).
 */
export function buildReviewContext(
  signals: ReviewSignal[],
  opts: { participantLabel?: string } = {},
): string {
  const who = opts.participantLabel?.trim() || '이 당사자'
  const lines = signals.map(
    (s) => `- [${s.kind}] (${SEV_LABEL[s.severity]}) ${s.label}: ${s.detail}`,
  )
  return [
    `${who}의 점검 신호 목록이에요. 아래 신호만 근거로 우선순위와 다음에 할 일을 정리해 주세요.`,
    lines.length ? lines.join('\n') : '- (감지된 신호가 없어요)',
  ].join('\n\n')
}

function extractJsonObject(raw: string): string | null {
  if (!raw) return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  return raw.slice(start, end + 1)
}

const PRIORITIES = new Set(['high', 'medium', 'low'])

/**
 * AI JSON 응답 파싱 — 방어적. 코드블록·잡텍스트를 걷어내고(첫 `{`~마지막 `}`), 파싱 실패·비배열은 빈 목록.
 * 각 항목은 priority(high|medium|low)·headline·action·basis 가 모두 문자열이어야 하고, headline·action 은 비어있지 않아야 한다.
 * ★환각 가드: basis 가 실제 감지된 신호(validKinds) 안에 없으면 그 항목을 버린다(신호 밖 제안 차단). 최대 5개.
 */
export function parseReviewSuggestions(
  raw: string,
  opts: { validKinds: string[] },
): { suggestions: ReviewSuggestion[] } {
  const json = extractJsonObject(raw)
  if (!json) return { suggestions: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { suggestions: [] }
  }

  const arr = (parsed as { suggestions?: unknown })?.suggestions
  if (!Array.isArray(arr)) return { suggestions: [] }

  const valid = new Set(opts.validKinds)
  const out: ReviewSuggestion[] = []

  for (const entry of arr) {
    const s = entry as Record<string, unknown>
    if (
      !s ||
      typeof s.priority !== 'string' ||
      typeof s.headline !== 'string' ||
      typeof s.action !== 'string' ||
      typeof s.basis !== 'string'
    ) {
      continue
    }
    if (!PRIORITIES.has(s.priority)) continue
    if (!valid.has(s.basis)) continue // 환각 가드: 감지 안 된 신호는 탈락

    const headline = s.headline.trim()
    const action = s.action.trim()
    if (!headline || !action) continue

    out.push({
      priority: s.priority as ReviewSuggestion['priority'],
      headline,
      action,
      basis: s.basis,
    })
    if (out.length === 5) break
  }

  return { suggestions: out }
}

/**
 * 가명처리 terms — 참여자 이름(person) · 기관명(agency). 컨텍스트에 이름·기관을 넣지 않더라도 안전망으로 넘긴다
 * (deidentify 는 텍스트에 실제 나타나는 값만 토큰화 = no-op safe). 빈·공백·중복은 걸러 넘긴다.
 */
export function reviewPiiTerms(input: {
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
