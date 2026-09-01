import { callAI } from '@/utils/ai'
import type { CallAIOptions } from '@/utils/ai'
import { deidentify, reidentify, type PiiTerm } from '@/utils/deidentify'

/**
 * 가명처리 게이트 래퍼 — 텍스트를 AI 로 보내는 **유일한 안전 경로**.
 * deidentify(원문→토큰) → callAI(토큰본만 전송) → reidentify(응답 토큰→원문). 계약: aiDeidentify.test.ts.
 * 설계: Plan&Source/goala_privacy_deid_assignment_W.md §1-3(선제 게이트).
 *
 * 요약·활동제안 등 텍스트 액션은 callAI 를 **직접 부르지 말고** 이 래퍼만 호출한다 — 그러면 가명처리가
 * 자동 보장된다(경계 테스트 aiGateBoundary.test.ts 가 액션의 직접 callAI import 를 금지·회귀 차단).
 * ocr.ts 만 예외(입력이 이미지라 텍스트 PII 없음).
 *
 * ★'@/utils/ai' 에서 callAI 만 값으로 import(골든이 Anthropic 생성 없이 목킹 가능하게). CallAIOptions 는
 *   type-only import(런타임 erase). 토큰 맵은 이 함수 스코프 지역 변수로만 — 저장·로깅 금지(설계 §1-1).
 */
export async function callAIDeidentified(
  userText: string,
  terms: PiiTerm[],
  opts?: CallAIOptions,
): Promise<string> {
  const { text, map } = deidentify(userText, terms)
  const response = await callAI(text, opts)
  return reidentify(response, map)
}
