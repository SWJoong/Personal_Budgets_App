import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redirect } from 'next/navigation'
import AdminParticipantReportRedirect from './page'

/**
 * P5 IA — redirect 회귀잠금: /admin/participants/[id]/report (redirect-lock/admin-participant-report)
 * 설계출처: Plan&Source/goala_p5_ia_W.md §redirectMap (D2).
 *
 * 성격: RED 가 아니라 회귀잠금(현재 GREEN). P4 에서 이미 stub·구현됨.
 *   admin 월간 보고서는 supporter/[participantId]/report 와 동일 기능 중복 —
 *   별도 화면을 두지 않고 canonical(/supporter/${id}/report)로 포워딩한다(관리자도 같은 보고서를 본다).
 *   중복 보고서 화면이 되살아나거나 포워딩 경로가 바뀌면 이 계약이 빨강이 된다.
 *
 * 단언 범위: 행위(redirect 호출 인자)만. params 는 Next 15 규약대로 Promise.
 */

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const mockRedirect = vi.mocked(redirect)

beforeEach(() => {
  mockRedirect.mockReset()
})

describe('redirect-lock/admin-participant-report — 중복 보고서 → canonical 포워딩', () => {
  it("params={id} 로 호출하면 redirect(`/supporter/${id}/report`) 로 포워딩한다", async () => {
    await AdminParticipantReportRedirect({ params: Promise.resolve({ id: 'p-123' }) })
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/supporter/p-123/report')
  })

  it('별도 admin 보고서 화면(JSX)을 렌더하지 않는다 — D2 정본으로 단일화', async () => {
    const result = await AdminParticipantReportRedirect({ params: Promise.resolve({ id: 'p-123' }) })
    expect(result).toBeUndefined()
  })
})
