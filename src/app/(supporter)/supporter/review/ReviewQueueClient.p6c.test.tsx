import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReviewQueueClient from './ReviewQueueClient'

/**
 * P6 Phase C — list 시맨틱: 영수증 검토 대기열 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §list (contract list.review-queue)
 *
 * items.map 이 <div key> 카드로 나열되고 컨테이너도 <div className='flex flex-col gap-3'> 라
 * role=list/listitem 이 없다 → 스크린리더가 "N개 항목"을 안내하지 못한다.
 * 'use client' + items prop → 렌더 가능.
 *
 * 단언: getByRole('list') 존재 + getAllByRole('listitem').length === N.
 * U impl: 컨테이너 <div>→<ul>, 카드 <div>→<li>(에러 배너는 li 밖). 대비 sweep 배치4a 겹침 → 동시 처리.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/actions/ruleCheck', () => ({
  decideRuleCheck: vi.fn(),
}))

const items = [1, 2, 3].map((i) => ({
  id: `rc-${i}`,
  ruleLabel: '계획에 없던 지출',
  participantName: `당사자${i}`,
  usageDate: '2026-09-01',
  amount: 10000 * i,
  description: '간식',
  placeName: null,
  receiptUrl: null,
}))

describe('P6-C list — ReviewQueueClient 목록 시맨틱 (review-queue-list)', () => {
  it('[RED] 검토 항목이 list/listitem 으로 렌더된다', () => {
    render(<ReviewQueueClient items={items} />)
    // RED: 현재 <div> 나열 — role=list/listitem 부재로 0건
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(items.length)
  })
})
