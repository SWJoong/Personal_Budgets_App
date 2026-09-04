import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ParticipantDetailClient from './ParticipantDetailClient'
import type { MonitoringRow } from '@/app/actions/monitoring'
import type { SettlementRow } from '@/app/actions/settlement'
import type { AppealRow } from '@/app/actions/appeal'

/**
 * P6 Phase C — list 시맨틱: 당사자 상세 3개 목록 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §list (contract list.participant-detail.three-lists)
 *
 * 이의신청/모니터링/정산 세 목록이 모두 <Card as='div'> 반복으로 <section> 직속 → role 없음.
 * (상단 요약 stat 카드 그리드는 요약이라 리스트 아님 → 제외. 각 섹션의 '추가' 폼 Card 도 리스트 밖.)
 * 'use client' → 렌더 가능(actions 모킹).
 *
 * 단언: 각 섹션(heading→closest section) scope 내 getByRole('list') + getAllByRole('listitem') === N.
 * U impl 최소수정: Card 프리미티브 as='li' + 컨테이너 <ul>. 대비 sweep 겹침 → 동시 처리.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/app/actions/monitoring', () => ({ recordMonitoring: vi.fn() }))
vi.mock('@/app/actions/settlement', () => ({ recordSettlement: vi.fn() }))
vi.mock('@/app/actions/appeal', () => ({
  decideAppeal: vi.fn(),
  recordAppealDueDate: vi.fn(),
}))

const appeals = [
  { id: 'a1', outcome: 'upheld', filed_on: '2026-09-01', ground: '사유1', due_on: '2026-09-10' },
  { id: 'a2', outcome: 'dismissed', filed_on: '2026-09-02', ground: '사유2', due_on: null },
] as unknown as AppealRow[]

const monitoringRecords = [
  { id: 'm1', monitoring_date: '2026-09-01', observed_change: '변화1', participant_voice: '말1' },
] as unknown as MonitoringRow[]

const settlements = [
  {
    id: 's1',
    settled_period: '2026-01~2026-06',
    accepted_amount: 100000,
    rejected_amount: 0,
    recovered_amount: 0,
    unused_amount: 0,
    note: null,
  },
] as unknown as SettlementRow[]

function sectionByHeading(name: string): HTMLElement {
  const section = screen.getByRole('heading', { name }).closest('section')
  expect(section).not.toBeNull()
  return section as HTMLElement
}

describe('P6-C list — ParticipantDetailClient 3개 목록 시맨틱 (participant-detail-lists)', () => {
  function renderClient() {
    render(
      <ParticipantDetailClient
        participantId="p-1"
        allocationId={null}
        allocatedAmount={null}
        copayAmount={null}
        copayStatus={null}
        monitoringRecords={monitoringRecords}
        settlements={settlements}
        appeals={appeals}
      />,
    )
  }

  it('[RED] 이의신청 목록이 list/listitem 으로 렌더된다', () => {
    renderClient()
    const scoped = within(sectionByHeading('다시 봐달라는 요청'))
    expect(scoped.getByRole('list')).toBeInTheDocument()
    expect(scoped.getAllByRole('listitem')).toHaveLength(appeals.length)
  })

  it('[RED] 모니터링 기록 목록이 list/listitem 으로 렌더된다', () => {
    renderClient()
    const scoped = within(sectionByHeading('모니터링 기록'))
    expect(scoped.getByRole('list')).toBeInTheDocument()
    expect(scoped.getAllByRole('listitem')).toHaveLength(monitoringRecords.length)
  })

  it('[RED] 정산 목록이 list/listitem 으로 렌더된다', () => {
    renderClient()
    const scoped = within(sectionByHeading('정산'))
    expect(scoped.getByRole('list')).toBeInTheDocument()
    expect(scoped.getAllByRole('listitem')).toHaveLength(settlements.length)
  })
})
