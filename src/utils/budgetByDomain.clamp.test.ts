import { describe, it, expect } from 'vitest'
import { clampBudgetEnvelope, splitRemaining } from './budgetByDomain'

/**
 * 예산 봉투/영역 "남은 돈" 표시 클램프 계약 (W 작성 · 추출 순수함수 잠금).
 * 스펙출처: 08 §8 ② (봉투: 초과 시 음수잔액 미노출 → 0원 + 초과분 분리) · §8 ⑨ (영역별 동일 규칙).
 *
 * 발달장애 맥락에서 음수 잔액(-12,345원)은 혼동을 준다 → "남은 돈"은 0원으로 클램프하고
 * 초과분은 별도(초과 X원)로 낸다. 경계(usedTotal==allocated / remaining==0)는 초과가 아니라
 * 정확 소진이다(strict `>`, budgetStatus 의 경계 철학과 동일). 이 순수함수는 budgets/[id]/page.tsx
 * 의 인라인 표시로직에서 추출됐고, 이 계약은 그 표시 불변식을 DB·렌더 없이 못박는다.
 */

describe('clampBudgetEnvelope — 봉투(전체) 남은 돈 클램프 (§8 ②)', () => {
  it('초과지출: 남은 0원 + 초과분 분리, overspent=true', () => {
    // 12000 - 10000 = 2000 초과. 남은 돈은 음수(-2000)로 보이지 않고 0, 초과분 2000 을 별도로.
    expect(clampBudgetEnvelope(10000, 12000)).toEqual({
      overspent: true,
      remainingDisplay: 0,
      overageDisplay: 2000,
    })
  })

  it('★경계: 정확 소진(usedTotal==allocated)은 초과 아님 — strict `>`', () => {
    // 이 케이스가 클램프의 핵심 계약: 같으면 overspent=false·남은 0·초과 0.
    // `>=` 로 잘못 구현하면 overspent=true 로 새어 경고문·danger 바가 오발화한다.
    expect(clampBudgetEnvelope(10000, 10000)).toEqual({
      overspent: false,
      remainingDisplay: 0,
      overageDisplay: 0,
    })
  })

  it('정상: 남은 돈 = 배정 − 사용, 초과 없음', () => {
    expect(clampBudgetEnvelope(10000, 3000)).toEqual({
      overspent: false,
      remainingDisplay: 7000,
      overageDisplay: 0,
    })
  })

  it('배정 0인데 지출 발생: 전액 초과(overspent=true, 남은 0)', () => {
    expect(clampBudgetEnvelope(0, 5000)).toEqual({
      overspent: true,
      remainingDisplay: 0,
      overageDisplay: 5000,
    })
  })
})

describe('splitRemaining — 영역별 남은 돈 분할 (§8 ⑨)', () => {
  it('도메인 초과(remaining<0): 음수 대신 0원 + 초과분', () => {
    // remaining = plannedSum − usageSum 가 음수면 초과. 표시상 남은 0, 초과 2000.
    expect(splitRemaining(-2000)).toEqual({ remainingDisplay: 0, overageDisplay: 2000 })
  })

  it('여유(remaining>0): 그대로 남은 돈, 초과 0', () => {
    expect(splitRemaining(500)).toEqual({ remainingDisplay: 500, overageDisplay: 0 })
  })

  it('★경계: remaining==0 은 초과 아님 — 남은 0·초과 0 (초과 배지 미노출)', () => {
    // 페이지 배선의 초과 게이트가 `domainOverage > 0` 이므로, 0 이면 배지가 뜨지 않아야 한다.
    expect(splitRemaining(0)).toEqual({ remainingDisplay: 0, overageDisplay: 0 })
  })
})
