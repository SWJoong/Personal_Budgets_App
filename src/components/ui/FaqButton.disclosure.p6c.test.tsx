import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FaqButton from './FaqButton'
import { FAQ_ITEMS, type FaqItem } from '@/data/faqContent'

/**
 * P6 Phase C — FaqButton 질문 펼침 상태 + 장식 이모지 (f13f641 재적용 범위의 같은 파일 잔여)
 * 닫기 ✕ 44px 는 #106 으로 이미 green(FaqButton.p6c.test.tsx 소유) → 재단언하지 않는다.
 *
 * - 질문 버튼의 ▲/▼ 가 펼침 상태의 유일한 표시였다(프로그램적 상태 없음) → aria-expanded 로 전달하고
 *   ▲/▼ 는 aria-hidden(접근명은 'Q + 질문' 만).
 * - 답변 보충(note) 앞 📌 는 장식 → aria-hidden.
 *
 * - (#201 검증 조건) 모든 질문에서 aria-expanded 가 따라온다: 누른 질문만 true, 나머지는 false, 다시 누르면 모두 false,
 *   펼친 채 다른 질문을 누르면 펼침이 옮겨 간다. ▲/▼ 를 숨겼으므로 이것이 펼침 상태의 유일한 신호다.
 *
 * 렌더 게이트: 순수 client(FAQ_ITEMS 정적). 첫 질문(0번)이 기본 펼침. 색 토큰 단언 없음.
 * 데이터: 기본은 실제 FAQ_ITEMS. 실제 데이터가 지금 1개라 '첫 질문만 맞는' 구현과 구분이 안 되므로,
 *   모든-질문 계약은 실제 데이터와 질문 3개 고정본(faq.items) 둘 다로 돌린다(모듈 getter 로 테스트별 교체).
 */
const faq = vi.hoisted(() => ({ items: null as FaqItem[] | null }))
vi.mock('@/data/faqContent', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/data/faqContent')>()
  return {
    ...real,
    get FAQ_ITEMS() {
      return faq.items ?? real.FAQ_ITEMS
    },
  }
})

afterEach(() => {
  faq.items = null
})

const THREE: FaqItem[] = [
  { question: '첫째 고정 질문인가요?', answer: '첫째 고정 답이에요.' },
  { question: '둘째 고정 질문인가요?', answer: '둘째 고정 답이에요.' },
  { question: '셋째 고정 질문인가요?', answer: '셋째 고정 답이에요.', note: '셋째 보충이에요.' },
]
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

  it.each([
    { label: '실제 FAQ_ITEMS', items: null },
    { label: '질문 3개 고정본', items: THREE },
  ])('$label: 질문마다 누른 질문만 aria-expanded=true 이고 나머지는 false 로 남는다', async ({ items }) => {
    faq.items = items
    const user = userEvent.setup()
    render(<FaqButton variant="inline" />)
    await user.click(screen.getByRole('button', { name: '자주 묻는 질문' }))

    const qs: HTMLElement[] = []
    for (const item of FAQ_ITEMS) {
      qs.push(await screen.findByRole('button', { name: (n) => n.includes(item.question) }))
    }
    expect(qs).toHaveLength((items ?? FAQ_ITEMS).length)
    const states = () => qs.map((q) => q.getAttribute('aria-expanded'))
    const only = (i: number | null) => qs.map((_, j) => String(j === i))

    // 기본: 첫 질문만 펼침
    expect(states()).toEqual(only(0))
    await user.click(qs[0])
    expect(states(), '첫 질문 접기').toEqual(only(null))

    // 질문마다: 누르면 그 질문만 펼침 → 다시 누르면 모두 접힘
    for (let i = 0; i < qs.length; i++) {
      await user.click(qs[i])
      expect(states(), `${i}번 펼침`).toEqual(only(i))
      await user.click(qs[i])
      expect(states(), `${i}번 접힘`).toEqual(only(null))
    }

    // 펼친 채로 다음 질문을 누르면 펼침이 옮겨 간다(앞 질문은 false 로)
    await user.click(qs[0])
    for (let i = 1; i < qs.length; i++) {
      await user.click(qs[i])
      expect(states(), `${i - 1}번 → ${i}번`).toEqual(only(i))
    }
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
