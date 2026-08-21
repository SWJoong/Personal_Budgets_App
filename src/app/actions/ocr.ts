'use server'

import { withTiming } from '@/utils/api-logger'
import { callAI, AI_MODELS, type AIImage } from '@/utils/ai'

/**
 * 영수증 OCR — Claude(Anthropic) 비전. 설계: goala_ai_client_W.md §2.
 * (GPT-4o 토큰 중단으로 기존 OpenAI 경로가 실패 → Claude 로 교체. 반환 계약은 기존과 동일:
 *  { success, data: { date, amount, store, address } } / { success:false, error }.)
 * 모델은 env AI_MODEL_OCR(기본 Haiku 4.5 — 물량·비용). 실시간(촬영 즉시 자동채움)이라 배치 미사용.
 */

const OCR_SYSTEM =
  "너는 영수증 분석 전문가야. 이미지에서 '날짜(YYYY-MM-DD)', '합계 금액(숫자만)', '상호명', '주소'를 찾아 JSON 으로만 답해. " +
  '주소가 없으면 null. 예: {"date":"2026-03-24","amount":15000,"store":"스타벅스","address":"서울특별시 강남구 테헤란로 101"}'

const MEDIA_BY_PREFIX: Record<string, AIImage['mediaType']> = {
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/jpeg': 'image/jpeg',
}

export async function analyzeReceipt(base64Image: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다.')
    return { success: false, error: 'API 키 설정이 필요합니다.' }
  }

  // data: URI 가 실려 와도 raw base64 로 정규화(SDK 는 prefix 없는 base64 를 받는다).
  const prefixMatch = base64Image.match(/^data:(image\/\w+);base64,/)
  const mediaType = (prefixMatch && MEDIA_BY_PREFIX[prefixMatch[1]]) || 'image/jpeg'
  const data = base64Image.replace(/^data:image\/\w+;base64,/, '')

  try {
    const raw = await withTiming('Claude OCR', () =>
      callAI('이 영수증에서 날짜, 금액, 상호명, 주소를 추출해줘.', {
        system: OCR_SYSTEM,
        model: AI_MODELS.ocr,
        image: { base64: data, mediaType },
        json: true,
        maxTokens: 400,
      })
    )

    const result = JSON.parse(raw)
    return {
      success: true,
      data: {
        date: result.date ?? null,
        amount: result.amount ?? null,
        store: result.store ?? null,
        address: result.address ?? null,
      },
    }
  } catch (error) {
    console.error('OCR 분석 오류:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
