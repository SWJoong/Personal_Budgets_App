import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiNotice, AI_NOTICE_TEXT } from '@/components/ui/AiNotice'

/**
 * AiNotice — AI 생성물 표시 공통 라벨 계약 (AI 기본법: 생성물 표시 · 사람 최종 판단).
 * 근거: docs/release/15 §6 "AI 보조로 작성 · 최종 검토는 담당자".
 *
 * 불변식(행위/시맨틱만 단언 — 토큰·색상 단언 금지):
 *   1) 두 audience 모두 보이는 글자 라벨을 렌더한다(비색큐 — 고대비 모드에서도 뜻이 남는다).
 *   2) 라벨은 '만든 주체(컴퓨터/AI)'와 '사람 최종 확인(선생님/담당자)'을 둘 다 담는다.
 *   3) 당사자 문구에는 'AI' 리터럴이 없다(P7 B4 규칙 — '컴퓨터'로 쓴다).
 *   4) 정적 라벨이다 — role=note 이고 라이브 영역(aria-live·status·alert)이 아니다(#191 한 번·한 채널).
 *   5) 장식 아이콘은 aria-hidden. 화면별 덧붙임(children)도 같은 라벨 안에 보인다.
 */

const AUDIENCES = ['participant', 'staff'] as const
const AI_LITERAL = /(?<![A-Za-z_])AI(?![A-Za-z_])/

describe('AiNotice — AI 생성물 표시 라벨', () => {
  it.each(AUDIENCES)('audience=%s: 보이는 글자 라벨을 렌더한다', (audience) => {
    render(<AiNotice audience={audience} />)
    expect(screen.getByText(AI_NOTICE_TEXT[audience])).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(AI_NOTICE_TEXT[audience])
  })

  it('당사자 라벨 = 쉬운 말(컴퓨터가 만든 · 선생님과 함께), AI 리터럴 없음', () => {
    expect(AI_NOTICE_TEXT.participant).toBe('컴퓨터가 만든 거예요. 선생님과 함께 봐요.')
    expect(AI_LITERAL.test(AI_NOTICE_TEXT.participant)).toBe(false)
  })

  it('실무자 라벨 = AI 보조 표시 + 최종 판단은 담당자', () => {
    expect(AI_NOTICE_TEXT.staff).toContain('AI 보조')
    expect(AI_NOTICE_TEXT.staff).toContain('최종 판단은 담당자가 해요')
  })

  it.each(AUDIENCES)('audience=%s: 라이브 영역이 아니다(정적 note)', (audience) => {
    const { container } = render(<AiNotice audience={audience} />)
    const note = screen.getByRole('note')
    expect(note).not.toHaveAttribute('aria-live')
    expect(container.querySelector('[aria-live],[role="status"],[role="alert"],[role="log"]')).toBeNull()
  })

  it('장식 아이콘은 aria-hidden 이고 뜻은 글자에서 온다', () => {
    const { container } = render(<AiNotice audience="staff" />)
    const hidden = container.querySelectorAll('[aria-hidden="true"]')
    expect(hidden.length).toBeGreaterThan(0)
    hidden.forEach((el) => expect(el.textContent).not.toContain(AI_NOTICE_TEXT.staff))
  })

  it('화면별 덧붙임(children)이 같은 라벨 안에 보인다', () => {
    render(<AiNotice audience="participant">사진에서 읽은 값이 맞는지 봐 주세요.</AiNotice>)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(AI_NOTICE_TEXT.participant)
    expect(note).toHaveTextContent('사진에서 읽은 값이 맞는지 봐 주세요.')
  })
})
