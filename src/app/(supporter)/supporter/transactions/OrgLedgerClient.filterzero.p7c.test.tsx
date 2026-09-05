import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrgLedgerClient, { type LedgerRow } from './OrgLedgerClient'

/**
 * P7 웨이브3 — 3상태 문구표준의 필터0 기준 예제 · 계약: emptystate.render.filterzero-orgledger (RED-jsdom)
 * 설계출처: Plan&Source/goala_p7_emptystate_W.md §3(STATE 2 필터0)
 *
 * OrgLedgerClient 는 이미 <EmptyState variant='inline'> 을 쓰지만 description 이 없다.
 *   3상태 표준상 필터0(데이터는 있으나 현재 조건에 안 걸림)은 '조건을 바꿔서 다시 찾아보세요' 를
 *   description 으로 반드시 안내해야 한다(다음 행동 = 조건 변경 자체이므로 별도 CTA link 는 선택).
 *
 * 이 화면은 canonical 3상태 예제 — 서버페이지 transactions/page.tsx = 진짜0(온보딩 CTA), 이
 *   client = 필터0. 서버페이지는 rows 가 있을 때만 이 client 를 렌더하므로 이 빈 분기는 항상 필터0.
 *
 * 단언 범위: EmptyState 존재(채택 회귀락) + description /조건을? 바꿔/ (RED). link 는 단언하지 않음.
 * RED 이유: 오늘 이 EmptyState 에 description 이 없다 → /조건을? 바꿔/ 매치 0 → RED. (채택 자체는 green)
 */

const ROW: LedgerRow = {
  id: 'r1',
  participantId: 'p1',
  participantName: '김지수',
  amount: 10000,
  settlementStatus: 'pending',
  usageDate: '2026-09-01',
  description: '점심',
}

describe('P7-C emptystate.render — OrgLedger 필터0 description (filterzero-orgledger)', () => {
  it('[GREEN-lock] EmptyState 채택이 유지된다 (필터로 0건이 되면 빈상태가 뜬다)', async () => {
    const user = userEvent.setup()
    render(<OrgLedgerClient rows={[ROW]} />)
    // 'pending' 한 건만 있는데 '반려'로 거르면 0건 → 필터0 빈상태.
    await user.click(screen.getByRole('button', { name: '반려' }))
    expect(screen.getByText(/지출이 없어요|결과가 없어요|내용이 없어요/)).toBeInTheDocument()
  })

  it("[RED] 필터0 빈상태가 '조건을 바꿔' 안내 description 을 포함한다", async () => {
    const user = userEvent.setup()
    render(<OrgLedgerClient rows={[ROW]} />)
    await user.click(screen.getByRole('button', { name: '반려' }))
    // RED: 현재 EmptyState 에 description 부재 → 이 문구 없음. U 가 description 배선 시 초록.
    expect(screen.getByText(/조건을? 바꿔/)).toBeInTheDocument()
  })
})
