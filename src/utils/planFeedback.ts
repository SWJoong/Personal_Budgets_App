/**
 * 계획 피드백 순수 검증·표시 — 계약: src/utils/planFeedback.test.ts.
 * 설계: docs/release/14 P2(④ 가벼운 피드백). 당사자가 이용계획에 "확인했어요/궁금해요"를 남긴다.
 */

export type PlanFeedbackKind = 'acknowledged' | 'question'

/** question 은 짧은 본문이 있어야 유효, acknowledged 는 본문 없이도 유효. */
export function planFeedbackValid(kind: PlanFeedbackKind, message?: string | null): boolean {
  if (kind === 'acknowledged') return true
  if (kind === 'question') return Boolean(message?.trim())
  return false
}

const KIND_LABEL: Record<PlanFeedbackKind, string> = {
  acknowledged: '확인했어요',
  question: '궁금해요',
}

export function planFeedbackKindLabel(kind: string): string {
  return KIND_LABEL[kind as PlanFeedbackKind] ?? kind
}
