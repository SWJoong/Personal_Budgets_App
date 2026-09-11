import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SisAssessmentClient from './SisAssessmentClient'

/**
 * SIS-A 척도 기록 화면(실무자) 계약 — 관리자 QA #9 부활 (RED 계약, W 레인).
 * 설계출처: Plan&Source/goala_sis_a_revival_W.md.
 * 구현 대상: src/app/(supporter)/supporter/[participantId]/sis/SisAssessmentClient.tsx.
 *
 * 배경: 채점 로직 src/utils/sis-a.ts(calculateSisA)는 생존. 6개 하위척도 원점수를 입력하면
 *   실시간으로 지원요구지수·백분위를 계산해 보여주고, 저장 시 액션에 raw 를 넘긴다. 과거 기록 목록.
 *
 * RED 사유: SisAssessmentClient 가 아직 없다.
 * 단언 범위: 입력·실시간 계산·저장 배선·목록만(배치·문구·토큰 제외).
 * 계산 근거(sis-a.ts RANGES): 2A50·2B56·2C55·2D52·2E49·2F48 → 각 표준점수 10 → 합 60 → 지수 '100'·백분위 '50'.
 */

const saveMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/app/actions/sisAssessment', () => ({
  saveSisAssessment: (...args: unknown[]) => saveMock(...args),
}))

beforeEach(() => {
  saveMock.mockReset()
})

// SIS_SUB_SCALES 라벨(sis-a.ts)을 정확 문자열로 — '사회'(2F)가 '지역사회 생활'(2B)의 부분이라 정규식 모호.
async function fillSixScores(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('가정 생활'), '50')
  await user.type(screen.getByLabelText('지역사회 생활'), '56')
  await user.type(screen.getByLabelText('평생학습'), '55')
  await user.type(screen.getByLabelText('고용'), '52')
  await user.type(screen.getByLabelText('건강 & 안전'), '49')
  await user.type(screen.getByLabelText('사회'), '48')
}

describe('SisAssessmentClient — SIS-A 척도 기록(실무자)', () => {
  it('6개 하위척도 원점수 입력칸을 보여준다', () => {
    render(<SisAssessmentClient participantId="p-1" assessments={[]} />)
    expect(screen.getByLabelText('가정 생활')).toBeInTheDocument()
    expect(screen.getByLabelText('지역사회 생활')).toBeInTheDocument()
    expect(screen.getByLabelText('평생학습')).toBeInTheDocument()
    expect(screen.getByLabelText('고용')).toBeInTheDocument()
    expect(screen.getByLabelText('건강 & 안전')).toBeInTheDocument()
    expect(screen.getByLabelText('사회')).toBeInTheDocument()
  })

  it('원점수를 입력하면 지원요구지수를 실시간 계산해 보여준다(합60→지수100)', async () => {
    const user = userEvent.setup()
    render(<SisAssessmentClient participantId="p-1" assessments={[]} />)
    await fillSixScores(user)
    // 실시간 계산 결과: 지원요구지수 100.
    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument())
  })

  it('저장하면 saveSisAssessment 가 participantId + raw 로 호출된다', async () => {
    saveMock.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<SisAssessmentClient participantId="p-1" assessments={[]} />)
    await fillSixScores(user)
    await user.click(screen.getByRole('button', { name: /저장|기록하기|기록 저장/ }))
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          participantId: 'p-1',
          raw: expect.objectContaining({ '2A': 50, '2B': 56, '2C': 55, '2D': 52, '2E': 49, '2F': 48 }),
        }),
      ),
    )
  })

  it('과거 SIS 기록 목록(지수·백분위)을 보여준다', () => {
    render(
      <SisAssessmentClient
        participantId="p-1"
        assessments={[
          {
            id: 's1',
            assessed_at: '2026-09-01',
            total_std: 90,
            index_score: '128-129',
            percentile: '>99',
          },
        ]}
      />,
    )
    expect(screen.getByText('128-129')).toBeInTheDocument()
    expect(screen.getByText(/>99/)).toBeInTheDocument()
  })
})
