/**
 * 가명처리 게이트웨이 — AI(callAI) 로 텍스트를 보내기 전 이름·기관·장소 식별자를 안정 토큰으로
 * 치환하고, AI 응답을 원문으로 복원한다. 계약: src/utils/deidentify.test.ts.
 * 설계: Plan&Source/goala_privacy_deid_assignment_W.md §1.
 *
 * ★토큰 맵은 **요청 스코프 메모리에만** 둔다 — 저장·로깅 금지(설계 §1-1). 이 모듈은 순수 함수만
 *   제공하고, 호출부(요약·활동제안 액션)가 map 을 지역 변수로만 다뤄야 한다.
 */

export type PiiKind = 'person' | 'agency' | 'place'

export interface PiiTerm {
  value: string
  kind: PiiKind
}

export interface DeidentifyResult {
  /** 식별자가 토큰으로 치환된 텍스트(AI 로 보낼 안전한 본문). */
  text: string
  /** 토큰 → 원문 복원 맵. 요청 스코프 메모리에만 보관(저장·로깅 금지). */
  map: Record<string, string>
}

const KIND_LABEL: Record<PiiKind, string> = {
  person: '사람',
  agency: '기관',
  place: '장소',
}

/**
 * 식별자 → 토큰 치환. 토큰 `[사람N]`·`[기관N]`·`[장소N]` 은 kind별 카운터로 terms **입력 순서**대로
 * 1부터 매긴다(호출부가 예측 가능). 불변식:
 * - 안정성: 같은 value 는 한 호출 안에서 항상 같은 토큰(중복 term·다중 등장 모두 하나).
 * - 겹침 안전: 긴 value 를 먼저 치환('김지수'가 '김' 토큰에 부서지지 않는다).
 * - 미출현 term 은 토큰·map 을 만들지 않는다(불필요 토큰 금지).
 */
export function deidentify(text: string, terms: PiiTerm[]): DeidentifyResult {
  const kindCounters: Record<PiiKind, number> = { person: 0, agency: 0, place: 0 }
  const assignedValues = new Set<string>() // 같은 value 중복 term 방지(안정성)
  const map: Record<string, string> = {}
  const assignments: { value: string; token: string }[] = []

  // 1) 토큰 배정 — terms 입력 순서. 텍스트에 실제로 나타나는 value 에만 번호를 매긴다.
  for (const term of terms) {
    if (!term.value || assignedValues.has(term.value)) continue
    if (!text.includes(term.value)) continue
    assignedValues.add(term.value)
    kindCounters[term.kind] += 1
    const token = `[${KIND_LABEL[term.kind]}${kindCounters[term.kind]}]`
    map[token] = term.value
    assignments.push({ value: term.value, token })
  }

  // 2) 치환 — 긴 value 를 먼저(부분 파괴 방지). 같은 value 는 전역 치환.
  const ordered = [...assignments].sort((a, b) => b.value.length - a.value.length)
  let out = text
  for (const { value, token } of ordered) {
    out = out.split(value).join(token)
  }

  return { text: out, map }
}

/**
 * 토큰 → 원문 복원. map 의 각 토큰을 전역 치환한다. 긴 토큰을 먼저 복원해
 * `[사람1]` 이 `[사람10]` 안을 부수지 않게 한다(10개 이상 엔티티 안전).
 */
export function reidentify(text: string, map: Record<string, string>): string {
  const tokens = Object.keys(map).sort((a, b) => b.length - a.length)
  let out = text
  for (const token of tokens) {
    out = out.split(token).join(map[token])
  }
  return out
}
