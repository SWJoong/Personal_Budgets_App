import { describe, it, expect } from 'vitest'
import { planFeedbackValid, planFeedbackKindLabel } from './planFeedback'

describe('planFeedbackValid', () => {
  it('확인했어요(acknowledged)는 본문 없이도 유효', () => {
    expect(planFeedbackValid('acknowledged')).toBe(true)
    expect(planFeedbackValid('acknowledged', '')).toBe(true)
  })

  it('궁금해요(question)는 본문이 있어야 유효', () => {
    expect(planFeedbackValid('question', '이건 왜 이래요?')).toBe(true)
    expect(planFeedbackValid('question', '')).toBe(false)
    expect(planFeedbackValid('question', '   ')).toBe(false)
    expect(planFeedbackValid('question', null)).toBe(false)
  })
})

describe('planFeedbackKindLabel', () => {
  it('kind 를 한글 라벨로', () => {
    expect(planFeedbackKindLabel('acknowledged')).toBe('확인했어요')
    expect(planFeedbackKindLabel('question')).toBe('궁금해요')
    expect(planFeedbackKindLabel('unknown')).toBe('unknown')
  })
})
