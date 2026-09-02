import type { PiiTerm } from '@/utils/deidentify'

/**
 * AI 활동 제안 — 순수 로직(입력 조립 · 응답 파싱 · 시스템 프롬프트). 계약: src/utils/activitySuggestion.test.ts.
 * 설계: Plan&Source/goala_ai_client_W.md §4.
 *
 * 서버 액션(src/app/actions/activitySuggestion.ts)이 이 유틸로 컨텍스트를 만들고, 가명처리 게이트
 * callAIDeidentified(컨텍스트, terms, {system: SUGGEST_SYSTEM, json:true, ...}) 로 보낸 뒤 parseSuggestions 로 파싱한다.
 * (액션의 직접 callAI 사용은 aiGateBoundary.test.ts 가 금지 — 이 유틸은 순수·부수효과 없음.)
 */

/** 활동 제안 시스템 프롬프트 — 쉬운 정보 규칙 공유 + 출력 스키마(설계 §4). */
export const SUGGEST_SYSTEM = `너는 발달장애 당사자에게 '해볼 만한 활동'을 제안하는 도우미다. 아래 규칙을 반드시 지켜라.
1) 쉬운 말로 쓴다. 짧은 문장, 쉬운 낱말, 존댓말('~요').
2) 당사자의 지원 영역과 '남은 돈' 안에서만 제안한다. 남은 돈보다 비싼 활동은 제안하지 않는다.
3) 가능하면 가까운 제공기관에서 할 수 있는 활동을 고른다.
4) 활동은 1개에서 3개만 제안한다.
5) 위협하거나 강요하는 말은 쓰지 않는다. 금액·사실을 지어내지 않는다.
출력은 아래 형태의 JSON 하나만 낸다(설명·코드블록 없이):
{"suggestions":[{"title":"짧은 제목","domain_id":"받은 영역 id 그대로","why":"쉬운 말 이유 한두 문장","est_cost":숫자(선택)}]}
domain_id 는 반드시 입력에서 준 영역 id 중 하나를 그대로 쓴다.`

export interface SuggestionDomainContext {
  domainId: string
  domainLabel: string
  remaining: number
  /** 이 영역에서 가까운 제공기관 이름(선택) — 컨텍스트에 넣고 terms 로도 de-id 한다. */
  providerNames?: string[]
}

export interface SuggestionContextInput {
  domains: SuggestionDomainContext[]
  interests?: string | null
}

export interface ActivitySuggestion {
  title: string
  domainId: string
  why: string
  estCost?: number
}

/** 원화 포맷(로케일 비의존, 결정성). */
function won(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
}

/**
 * 제안 컨텍스트(AI 입력) 조립 — **남은 돈이 있는 영역만**(remaining > 0) 넣는다(예산 안에서 제안 원칙).
 * 남은 영역이 없으면 그 사실을 명시한다. 순수 함수(결정성).
 */
export function buildSuggestionContext(input: SuggestionContextInput): string {
  const parts: string[] = []

  const lines = input.domains
    .filter((d) => d.remaining > 0)
    .map((d) => {
      const prov = d.providerNames?.length ? ` / 가까운 곳: ${d.providerNames.join(', ')}` : ''
      return `- ${d.domainLabel}(id:${d.domainId}): 남은 돈 ${won(d.remaining)}${prov}`
    })

  parts.push(
    '쓸 수 있는 영역과 남은 예산:\n' +
      (lines.length ? lines.join('\n') : '- (남은 예산이 있는 영역이 없어요)'),
  )

  if (input.interests?.trim()) parts.push('관심·이력: ' + input.interests.trim())

  return parts.join('\n\n')
}

function extractJsonObject(raw: string): string | null {
  if (!raw) return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  return raw.slice(start, end + 1)
}

/**
 * AI JSON 응답 파싱 — 방어적. 코드블록·잡텍스트를 걷어내고(첫 `{`~마지막 `}`), 파싱 실패·비배열은 빈 목록.
 * 각 항목은 title·domain_id·why 가 모두 문자열이어야 하고, validDomainIds 를 주면 그 안의 영역만 통과(환각 방지).
 * 최대 3개로 자른다. domain_id/est_cost 는 camelCase(domainId/estCost)로 정규화한다.
 */
export function parseSuggestions(
  raw: string,
  opts: { validDomainIds?: string[] } = {},
): { suggestions: ActivitySuggestion[] } {
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

  const valid = opts.validDomainIds ? new Set(opts.validDomainIds) : null
  const out: ActivitySuggestion[] = []

  for (const entry of arr) {
    const s = entry as Record<string, unknown>
    if (!s || typeof s.title !== 'string' || typeof s.domain_id !== 'string' || typeof s.why !== 'string') {
      continue
    }
    if (valid && !valid.has(s.domain_id)) continue

    const title = s.title.trim()
    const why = s.why.trim()
    if (!title || !why) continue

    const item: ActivitySuggestion = { title, domainId: s.domain_id, why }
    if (typeof s.est_cost === 'number' && isFinite(s.est_cost) && s.est_cost >= 0) {
      item.estCost = Math.round(s.est_cost)
    }
    out.push(item)
    if (out.length === 3) break
  }

  return { suggestions: out }
}

/**
 * 가명처리 terms — 참여자 이름(person) · 제공기관명(agency). 컨텍스트에 넣은 기관명을 그대로 de-id 한다.
 * 빈·공백·중복은 걸러 넘긴다(deidentify 는 텍스트에 실제 나타나는 값만 토큰화 = no-op safe).
 */
export function suggestionPiiTerms(input: {
  participantName?: string | null
  providerNames?: (string | null | undefined)[]
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
  for (const p of input.providerNames ?? []) push(p, 'agency')
  return terms
}
