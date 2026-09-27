import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FaqButton from './FaqButton'
import { FAQ_ITEMS } from '@/data/faqContent'

/**
 * P6 Phase C — FaqButton 질문 펼침 상태 + 장식 이모지 (f13f641 재적용 범위의 같은 파일 잔여)
 * 닫기 ✕ 44px 는 #106 으로 이미 green(FaqButton.p6c.test.tsx 소유) → 재단언하지 않는다.
 *
 * - 질문 버튼의 ▲/▼ 가 펼침 상태의 유일한 표시였다(프로그램적 상태 없음) → aria-expanded 로 전달하고
 *   ▲/▼ 는 aria-hidden(접근명은 'Q + 질문' 만).
 * - 답변 보충(note) 앞 📌 는 장식 → aria-hidden.
 *
 * 렌더 게이트: 순수 client(FAQ_ITEMS 정적). 첫 질문(0번)이 기본 펼침. 색 토큰 단언 없음.
 */
describe('P6-C disclosure — FaqButton 질문 펼침 상태 (faqbutton-question-expanded)', () => {
  it('질문 버튼이 aria-expanded 로 펼침 상태를 알리고, 클릭하면 바뀐다', async () => {
    const user = userEvent.setup()
    render(<FaqButton variant="inline" />)
    await user.click(screen.getByRole('button', { name: '자주 묻는 질문' }))

    const first = await screen.findByRole('button', { name: (n) => n.includes(FAQ_ITEMS[0].question) })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    // ▲/▼ 는 접근명에 섞이지 않는다
    expect(first).not.toHaveAccessibleName(/[▲▼]/)

    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('P6-C 장식 이모지 — FaqButton 보충 설명 📌 (faqbutton-note-emoji-hidden)', () => {
  it('펼친 답변의 📌 는 aria-hidden 이다', async () => {
    const user = userEvent.setup()
    const idx = FAQ_ITEMS.findIndex((f) => f.note)
    expect(idx).toBeGreaterThanOrEqual(0) // note 있는 항목이 데이터에 존재(계약 전제)
    render(<FaqButton variant="inline" />)
    await user.click(screen.getByRole('button', { name: '자주 묻는 질문' }))
    if (idx !== 0) {
      await user.click(await screen.findByRole('button', { name: (n) => n.includes(FAQ_ITEMS[idx].question) }))
    }
    expect((await screen.findByText('📌')).closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
