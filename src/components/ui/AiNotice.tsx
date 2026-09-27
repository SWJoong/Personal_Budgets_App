import type { ReactNode } from 'react'

/**
 * AiNotice — AI 생성물 표시 공통 라벨 (AI 기본법: 생성물 표시 · 사람 최종 판단).
 * 근거: docs/release/15 §6 — AI 산출물에 "AI 보조로 작성 · 최종 검토는 담당자"를 보이게 표시한다.
 * 계약: src/components/ui/AiNotice.test.tsx.
 *
 * - 정적 라벨이다(라이브 영역 아님, role=note). 진행·결과 알림은 각 화면의 기존 채널(announce·aria-live)
 *   하나만 쓴다 — 같은 뜻을 두 채널로 읽히지 않게(#191 '한 번·한 채널' 규칙).
 * - 비색큐: 뜻은 글자에 있다(고대비 모드는 info 토큰을 #fff/#000 로 비운다). 🤖 아이콘은 장식(aria-hidden).
 * - audience: participant = 쉬운 말. 당사자 문구엔 'AI' 리터럴 대신 '컴퓨터'를 쓴다(P7 B4 규칙,
 *   Plan&Source/goala_p7_copy_W.md). staff = 실무 용어 그대로.
 * - headline: 당사자 화면은 주어·동사를 화면에 맞춘다(AI_NOTICE_PARTICIPANT) — 영수증 칸은 컴퓨터가 '읽은' 값이지
 *   '만든' 값이 아니고, 활동 추천은 '추천'이 주어다. 기본값은 AI_NOTICE_TEXT[audience].
 * - children: 화면별로 뜻이 있는 덧붙임(예: 확인 요청·과신 고지). 핵심 문장과 겹치지 않게 쓴다.
 */

export type AiNoticeAudience = 'participant' | 'staff'

export const AI_NOTICE_TEXT: Record<AiNoticeAudience, string> = {
  participant: '컴퓨터가 만든 내용이에요. 선생님과 함께 봐요.',
  staff: 'AI 보조로 만든 내용이에요. 최종 판단은 담당자가 해요.',
}

/** 당사자 화면별 머리말 — 쉬운 말 검사(validate_easy_read) 통과 문구. */
export const AI_NOTICE_PARTICIPANT = {
  activity: '추천은 컴퓨터가 만들었어요. 선생님과 함께 봐요.',
  receipt: '컴퓨터가 영수증 사진을 읽었어요.',
} as const

export interface AiNoticeProps {
  audience: AiNoticeAudience
  /** 화면에 맞춘 머리말. 없으면 AI_NOTICE_TEXT[audience]. */
  headline?: string
  children?: ReactNode
}

export function AiNotice({ audience, headline, children }: AiNoticeProps) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2 rounded-xl bg-info-bg px-3 py-2 text-info-fg ring-1 ring-info-fg/20 leading-relaxed ${
        audience === 'participant' ? 'text-sm' : 'text-xs'
      }`}
    >
      <span aria-hidden="true">🤖</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-bold">{headline ?? AI_NOTICE_TEXT[audience]}</span>
        {children ? <span className="font-medium">{children}</span> : null}
      </span>
    </div>
  )
}
