import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ParticipantEvaluationsPage from './page'

/**
 * 계약(W레인·RED) : view-as 정산 충실도 — 대상의 **모든** allocation 을 스코프한다(C2, docs/release/08 §9).
 * 구현 대상: src/app/(participant)/evaluations/page.tsx
 *
 * 배경(갭): view-as 브랜치가 대상의 **최신 allocation 1건**(limit 1, maybeSingle)만 찾아
 * getSettlements(단일 id) 로 넘긴다 → 다건 배정 당사자의 과거 정산이 빠져, view-as 가 당사자
 * 실제 화면(자기 모든 정산)보다 적게 보인다. 정본: 대상의 모든 allocation id 를 모아 배열로 넘긴다.
 *
 * 이 계약은 mock 이 대상에게 allocation 2건(a1·a2)을 준 상태에서 getSettlements 가 **배열 [a1,a2]**
 * 로 호출되는지를 단언한다. 현재 코드는 최신 1건('a1' 문자열)만 넘기므로 RED.
 * (getSettlements 자체의 배열→.in 필터는 settlement.test.ts 가 잠근다.)
 */

const { getSettlementsSpy } = vi.hoisted(() => ({
  getSettlementsSpy: vi.fn<(allocation?: string | string[]) => Promise<{ settlements: unknown[] }>>(
    () => Promise.resolve({ settlements: [] }),
  ),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/utils/supabase/viewAs', () => ({
  resolveViewAs: async () => ({ active: true, participantId: 'target-1' }),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    from: () => {
      // 대상 참여자에게 allocation 2건. 현재(잘못된) 경로 .limit(1).maybeSingle() 는 최신 1건을,
      // 정본 경로(await select().eq())는 전체 배열을 돌려준다 — 같은 빌더가 둘 다 지원.
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => b,
        maybeSingle: async () => ({ data: { id: 'a1' } }),
        then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [{ id: 'a1' }, { id: 'a2' }], error: null }),
      }
      return b
    },
  }),
}))
vi.mock('@/app/actions/monitoring', () => ({
  getMonitoringRecords: async () => ({ records: [] }),
}))
vi.mock('@/app/actions/settlement', () => ({
  getSettlements: (allocation?: string | string[]) => getSettlementsSpy(allocation),
}))

describe('ParticipantEvaluationsPage — view-as 정산 전체 allocation 스코프 (C2)', () => {
  it('[RED] view-as: 대상의 모든 allocation id 를 배열로 getSettlements 에 넘긴다(최신 1건 아님)', async () => {
    getSettlementsSpy.mockClear()
    render(await ParticipantEvaluationsPage())

    expect(getSettlementsSpy).toHaveBeenCalledTimes(1)
    const arg = getSettlementsSpy.mock.calls[0][0]
    // 현재 코드: 최신 1건 'a1'(문자열) → Array.isArray false → RED.
    expect(Array.isArray(arg)).toBe(true)
    expect(arg).toEqual(expect.arrayContaining(['a1', 'a2']))
  })
})
