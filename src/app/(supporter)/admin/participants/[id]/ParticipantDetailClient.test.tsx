import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ParticipantDetailClient from './ParticipantDetailClient'

/**
 * P5 IA — BUILD-B 잔여: B4 미리보기 진입점 배선 (buildb/b4-preview-entry-link)
 * 설계출처: Plan&Source/goala_p5_ia_W.md §BUILD-B (B4).
 *
 * 목표: admin/participants/[id]/preview 화면(당사자 화면 미리보기)은 완성됐으나 진입점이
 *   어디에도 배선돼 있지 않다 — 상세 화면(page 헤더=뒤로가기 링크뿐, 이 client 컴포넌트에도
 *   preview 링크 0). 코드베이스 전체에서 '/preview' 참조는 PreviewBanner(진입 '후' 전환 드롭다운)
 *   1곳뿐이라 URL 직접입력 외엔 도달 불가.
 *
 * RED 사유: 현재 이 컴포넌트에 preview 진입 링크가 전무 →
 *   getByRole('link', {name: /미리보기|당사자 화면 미리보기/}) 가 throw → RED.
 *   U 가 이미 prop 으로 받는 participantId 로 /admin/participants/${id}/preview 진입 링크를 배선하면 초록.
 *
 * 표면 선택 근거: participantId 를 이미 prop 으로 받는 client 컴포넌트라 jsdom 렌더가 가볍다
 *   (server page 단언 시 requireAdmin/supabase/actions 모킹 필요). PreviewBanner 내부 드롭다운은
 *   '진입 후'에만 노출되므로 진입점으로 인정하지 않는다.
 * 단언 범위: 행위(링크 존재·href)만. 배치·문구 정확표기·토큰은 단언하지 않는다.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/app/actions/monitoring', () => ({ recordMonitoring: vi.fn() }))
vi.mock('@/app/actions/settlement', () => ({ recordSettlement: vi.fn() }))
vi.mock('@/app/actions/appeal', () => ({
  decideAppeal: vi.fn(),
  recordAppealDueDate: vi.fn(),
}))

function renderDetail() {
  return render(
    <ParticipantDetailClient
      participantId="p-42"
      allocationId={null}
      allocatedAmount={null}
      copayAmount={null}
      copayStatus={null}
      monitoringRecords={[]}
      settlements={[]}
      appeals={[]}
    />
  )
}

describe('buildb/b4-preview-entry-link — 당사자 상세에 미리보기 진입점', () => {
  it("당사자 화면 미리보기(/admin/participants/[id]/preview)로 가는 진입 링크가 존재한다", () => {
    renderDetail()
    // RED: 현재 상세 화면에 preview 진입 링크 부재 → getByRole throw
    const link = screen.getByRole('link', { name: /미리보기|당사자 화면 미리보기/ })
    expect(link).toHaveAttribute('href', '/admin/participants/p-42/preview')
  })

  it('미리보기 진입이 렌더된 표면에서 프로그램적으로 도달 가능하다(URL 직접입력 아님)', () => {
    renderDetail()
    // 링크 role 로 도달 가능해야 한다(nav/버튼 표면에 존재)
    expect(screen.getByRole('link', { name: /미리보기|당사자 화면 미리보기/ })).toBeInTheDocument()
  })
})
