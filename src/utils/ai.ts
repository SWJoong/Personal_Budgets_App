import Anthropic from '@anthropic-ai/sdk'

/**
 * AI 공급자 단일화 — Claude(Anthropic). 설계: Plan&Source/goala_ai_client_W.md §1.
 * OCR·요약·활동제안이 이 하나의 클라이언트를 공유한다. 공급자·모델 교체는 여기 한 곳.
 *
 * 배경: GPT-4o 토큰 중단으로 기존 OpenAI OCR 이 런타임 실패 → Claude 로 교체.
 * 서버 전용(ANTHROPIC_API_KEY). 'use server' 액션에서만 import 한다.
 */

const client = new Anthropic() // ANTHROPIC_API_KEY (env, 서버 전용)

/** 용도별 모델 티어 — env 로 코드 수정 없이 교체(설계 §1·§5). 비용 최적화: OCR=Haiku, 요약·제안=Sonnet. */
export const AI_MODELS = {
  ocr: process.env.AI_MODEL_OCR || 'claude-haiku-4-5',
  summary: process.env.AI_MODEL_SUMMARY || 'claude-sonnet-5',
  suggest: process.env.AI_MODEL_SUGGEST || 'claude-sonnet-5',
  default: process.env.AI_MODEL_DEFAULT || 'claude-haiku-4-5',
} as const

export interface AIImage {
  base64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface CallAIOptions {
  system?: string
  /** 기본 AI_MODELS.default */
  model?: string
  /** 기본 1024 */
  maxTokens?: number
  /** 비전(OCR) 입력 이미지 */
  image?: AIImage
  /** JSON 출력 강제(프롬프트 기반) — 호출부에서 JSON.parse */
  json?: boolean
  /** 공통 지침 프롬프트 캐싱(요약·제안의 반복 system 접두) */
  cacheSystem?: boolean
}

const JSON_ONLY = '\n\n반드시 유효한 JSON 하나만 출력하세요. 코드블록·설명 없이 JSON 만.'

/**
 * 단일 메시지 호출 → 첫 text 블록 반환.
 * JSON 은 스키마 없는 범용 호출이라 프롬프트로 강제하고(설계 §1) 호출부가 파싱한다.
 * 타입드 예외(RateLimitError/APIError)는 그대로 던져 호출부가 친절 메시지로 분기한다.
 */
export async function callAI(userText: string, opts: CallAIOptions = {}): Promise<string> {
  const userContent: Anthropic.MessageParam['content'] = opts.image
    ? [
        {
          type: 'image',
          source: { type: 'base64', media_type: opts.image.mediaType, data: opts.image.base64 },
        },
        { type: 'text', text: userText },
      ]
    : userText

  const systemText = opts.json
    ? (opts.system ?? '') + JSON_ONLY
    : opts.system

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: opts.model || AI_MODELS.default,
    max_tokens: opts.maxTokens ?? 1024,
    messages: [{ role: 'user', content: userContent }],
  }
  if (systemText) {
    params.system = opts.cacheSystem
      ? [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }]
      : systemText
  }

  const response = await client.messages.create(params)
  for (const block of response.content) {
    if (block.type === 'text') return block.text
  }
  return ''
}
