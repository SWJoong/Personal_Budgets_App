import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import WaterCupPlanPreview from './WaterCupPlanPreview'

/**
 * 물컵 계획 미리보기 — 고아 컴포넌트 복원 계약 (W 레인). "쓰면 얼마가 남을까" 시각화(인지 접근성).
 * 설계: Plan&Source/goala_orphan_components_restore_W.md §2.
 *
 * 배경: WaterCupPlanPreview 는 만들어졌으나 소비처 0(리빌드 유실) + raw hex 색(테마 미대응). 복원 시
 *   /plan 에 배선하고 색을 시맨틱 토큰으로 이관한다. 이 계약은 텍스트 내용(옵션·남는 돈·초과)만 고정한다.
 *
 * RED 사유: 파일은 있으나(고아) 계약 없음 — 렌더 특성을 골든으로 박아 복원·토큰화 회귀를 막는다.
 */

afterEach(() => cleanup())

const OPTIONS = [
  { name: '미술 수업', cost: 200000 },
  { name: '여행', cost: 600000 },
]

describe('WaterCupPlanPreview — 계획 미리보기', () => {
  it('옵션 이름과 쓸 돈을 보여준다', () => {
    render(<WaterCupPlanPreview currentBalance={500000} totalBudget={2000000} options={OPTIONS} selectedIndex={null} />)
    expect(screen.getByText(/미술 수업/)).toBeInTheDocument()
    expect(screen.getByText(/여행/)).toBeInTheDocument()
    expect(screen.getByText(/쓸 돈 200,000원/)).toBeInTheDocument()
  })

  it('고르면 남는 돈을 계산해 보여준다(50만 - 20만 = 30만)', () => {
    render(<WaterCupPlanPreview currentBalance={500000} totalBudget={2000000} options={OPTIONS} selectedIndex={0} />)
    expect(screen.getByText(/고른 후/)).toBeInTheDocument()
    expect(screen.getAllByText(/300,000/).length).toBeGreaterThan(0)
  })

  it('잔액보다 비싼 옵션은 "돈이 모자라요"', () => {
    render(<WaterCupPlanPreview currentBalance={500000} totalBudget={2000000} options={OPTIONS} selectedIndex={1} />)
    expect(screen.getAllByText(/돈이 모자라요/).length).toBeGreaterThan(0)
  })
})
