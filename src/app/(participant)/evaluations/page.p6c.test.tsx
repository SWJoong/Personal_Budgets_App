import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ParticipantEvaluationsPage from './page'

/**
 * P6 Phase C — list 시맨틱: 선생님이 남긴 기록(평가/정산) (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §list (contract list.evaluations.records-and-settlements)
 *
 * records.map → <article>(listitem 아님), settlements.map → <div>. 각 <section> 직속 role 없음.
 * async 서버 컴포넌트 → jsdom 렌더 게이트: 데이터 계층(createClient·getMonitoringRecords·
 * getSettlements) 모킹 후 render(await Page()). (대안: 목록부 client 서브컴포넌트 추출.)
 *
 * 단언: 두 목록이 list 로, 항목 합계가 listitem 으로 렌더(현재 0). 대비 sweep 배치3(23 hits) 겹침.
 */
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
  }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/app/actions/monitoring', () => ({
  getMonitoringRecords: async () => ({
    records: [
      { id: 'm1', method: 'visit', monitoring_date: '2026-09-01', observed_change: '변화1', participant_voice: '말1' },
      { id: 'm2', method: 'phone', monitoring_date: '2026-09-02', observed_change: '변화2', participant_voice: null },
    ],
  }),
}))
vi.mock('@/app/actions/settlement', () => ({
  getSettlements: async () => ({
    settlements: [
      { id: 's1', settled_period: '2026-01~2026-06', accepted_amount: 100000, unused_amount: 0 },
    ],
  }),
}))

describe('P6-C list — 평가/정산 목록 시맨틱 (evaluations-lists)', () => {
  it('[RED] 기록·정산이 list/listitem 으로 렌더된다', async () => {
    render(await ParticipantEvaluationsPage())
    // RED: 현재 <article>/<div> 나열 — list 0개, listitem 0건
    expect(screen.getAllByRole('list').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(3) // records(2) + settlements(1)
  })
})
