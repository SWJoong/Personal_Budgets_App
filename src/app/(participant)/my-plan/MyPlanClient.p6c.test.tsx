import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import MyPlanClient from './MyPlanClient'

/**
 * P6 Phase C — list 시맨틱: 내 이용계획 '쓰고 싶은 서비스' (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §list (contract list.my-plan.services)
 *
 * filledServices.map 이 <div key> 로 <section> 직속 나열 → role 없음.
 * (같은 파일 NARRATIVE_FIELDS 는 폼 필드 맵이라 리스트 아님 → 제외.)
 * 'use client' → 렌더 가능(단, ActivitySuggestions 는 AI 서버액션 import 라 스텁 격리).
 *
 * 단언: '쓰고 싶은 서비스' 섹션 scope 내 getAllByRole('listitem').length === N.
 * 대비 sweep 배치3(39 hits, 최다)과 겹침 → U 동시 처리 권장.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/app/actions/planReview', () => ({ markNotificationRead: vi.fn() }))
vi.mock('@/app/actions/appeal', () => ({ fileAppeal: vi.fn() }))
vi.mock('./ActivitySuggestions', () => ({ default: () => null }))

const plan = { id: 'plan-1', application_id: 'app-1', cohort_id: 'cohort-1', status: 'submitted' }
const requestedServices = [1, 2, 3].map((priority) => ({
  id: `svc-${priority}`,
  priority,
  service_name: `서비스${priority}`,
  estimated_cost: 10000 * priority,
}))

describe('P6-C list — MyPlanClient 서비스 목록 시맨틱 (my-plan-services-list)', () => {
  it('[RED] 쓰고 싶은 서비스가 list/listitem 으로 렌더된다', () => {
    render(
      <MyPlanClient
        participantId="p-1"
        plan={plan}
        narrative={null}
        requestedServices={requestedServices}
        latestReview={null}
        notification={null}
        appeal={null}
      />,
    )
    const section = screen.getByRole('heading', { name: '쓰고 싶은 서비스' }).closest('section')
    expect(section).not.toBeNull()
    const scoped = within(section as HTMLElement)
    // RED: 현재 <div> 나열 — listitem 0건
    expect(scoped.getAllByRole('listitem')).toHaveLength(requestedServices.length)
  })
})
