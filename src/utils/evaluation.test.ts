import { describe, it, expect } from 'vitest'
import {
  ACHIEVEMENT_LEVELS,
  isAchievement,
  achievementLabel,
  isValidPeriod,
  periodInKST,
  shiftPeriod,
  periodLabel,
  summarizeMonthUsage,
  spentByRequestedService,
  evaluationHasContent,
  isFuturePeriod,
  formatKSTDateTime,
  selectEvaluationPlan,
  type PlanCandidate,
} from './evaluation'

describe('이행 정도(achievement)', () => {
  it('4단계가 낮음→높음 순서로 DB CHECK 값과 일치', () => {
    expect(ACHIEVEMENT_LEVELS.map((l) => l.value)).toEqual(['not_achieved', 'partial', 'achieved', 'exceeded'])
  })

  it('isAchievement 는 4개 코드만 허용', () => {
    expect(isAchievement('achieved')).toBe(true)
    expect(isAchievement('maybe')).toBe(false)
    expect(isAchievement(undefined)).toBe(false)
    expect(isAchievement(3)).toBe(false)
  })

  it('achievementLabel 은 한글, 미등록은 원문', () => {
    expect(achievementLabel('partial')).toBe('부분 이행')
    expect(achievementLabel('exceeded')).toBe('초과 달성')
    expect(achievementLabel('weird')).toBe('weird')
  })
})

describe('달 키(period)', () => {
  it('isValidPeriod 는 DB CHECK 와 같은 형식만 통과', () => {
    expect(isValidPeriod('2026-09')).toBe(true)
    expect(isValidPeriod('2026-12')).toBe(true)
    expect(isValidPeriod('2026-13')).toBe(false)
    expect(isValidPeriod('2026-00')).toBe(false)
    expect(isValidPeriod('2026-9')).toBe(false)
    expect(isValidPeriod('2026-09-01')).toBe(false)
  })

  it('periodInKST 는 서버 TZ 와 무관하게 한국 달을 준다(월말 UTC 저녁 = KST 다음 달)', () => {
    expect(periodInKST(new Date('2026-09-30T14:59:59Z'))).toBe('2026-09') // KST 23:59
    expect(periodInKST(new Date('2026-09-30T15:00:00Z'))).toBe('2026-10') // KST 10/1 00:00
    expect(periodInKST(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01')
  })

  it('shiftPeriod 는 연도를 넘긴다', () => {
    expect(shiftPeriod('2026-09', 1)).toBe('2026-10')
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01')
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12')
    expect(shiftPeriod('2026-03', -14)).toBe('2025-01')
  })

  it('periodLabel 은 한국어 표기', () => {
    expect(periodLabel('2026-09')).toBe('2026년 9월')
    expect(periodLabel('2027-01')).toBe('2027년 1월')
  })
})

describe('그 달 지출 요약', () => {
  const rows = [
    { amount: 10000, settlement_status: 'pending', requested_service_id: 'rs-art' },
    { amount: '5000', settlement_status: 'accepted', requested_service_id: 'rs-art' },
    { amount: 3000, settlement_status: 'rejected', requested_service_id: 'rs-swim' },
    { amount: 7000, settlement_status: 'recovered', requested_service_id: 'rs-art' },
    { amount: 2000, settlement_status: 'accepted', requested_service_id: null },
  ]

  it('쓴 돈은 환수 제외 합계(v_seoul_monthly_usage 와 같은 정의), 건수는 전체', () => {
    const s = summarizeMonthUsage(rows)
    expect(s.spent).toBe(10000 + 5000 + 3000 + 2000)
    expect(s.count).toBe(5)
    expect(s.byStatus.accepted).toEqual({ count: 2, amount: 7000 })
    expect(s.byStatus.recovered).toEqual({ count: 1, amount: 7000 })
    expect(s.byStatus.pending.count).toBe(1)
  })

  it('빈 달은 0', () => {
    const s = summarizeMonthUsage([])
    expect(s.spent).toBe(0)
    expect(s.count).toBe(0)
    expect(s.byStatus.rejected).toEqual({ count: 0, amount: 0 })
  })

  it('항목별 쓴 돈 — 환수·항목 미연결 제외', () => {
    expect(spentByRequestedService(rows)).toEqual({ 'rs-art': 15000, 'rs-swim': 3000 })
  })
})

describe('evaluationHasContent', () => {
  it('서술 한 칸(공백 제외) 또는 항목 1건이면 저장 가능', () => {
    expect(evaluationHasContent({ overallNote: '잘 됨', itemCount: 0 })).toBe(true)
    expect(evaluationHasContent({ itemCount: 1 })).toBe(true)
  })

  it('전부 비었거나 공백뿐이면 불가', () => {
    expect(evaluationHasContent({ itemCount: 0 })).toBe(false)
    expect(evaluationHasContent({ budgetUsageNote: '   ', participantOpinion: '', overallNote: null, itemCount: 0 })).toBe(false)
  })
})

describe('isFuturePeriod · formatKSTDateTime', () => {
  it('기준 달보다 뒤인 달만 미래', () => {
    expect(isFuturePeriod('2026-10', '2026-09')).toBe(true)
    expect(isFuturePeriod('2026-09', '2026-09')).toBe(false)
    expect(isFuturePeriod('2025-12', '2026-01')).toBe(false)
  })

  it('저장 시각은 한국 시간으로 — UTC 자정 전후가 하루 밀리지 않는다', () => {
    expect(formatKSTDateTime('2026-09-24T16:30:00Z')).toBe('2026.09.25 01:30')
    expect(formatKSTDateTime('2026-09-25T05:03:00+00:00')).toBe('2026.09.25 14:03')
    expect(formatKSTDateTime('not-a-date')).toBe('')
  })
})

describe('selectEvaluationPlan — 평가 기준 계획 고르기', () => {
  const plan = (over: Partial<PlanCandidate> & { id: string }): PlanCandidate => ({
    status: 'approved',
    start: null,
    end: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  })
  const h2 = plan({ id: 'A-2026H2', start: '2026-07-01', end: '2026-12-31', createdAt: '2026-06-01T00:00:00Z' })
  const h1 = plan({ id: 'B-2027H1', start: '2027-01-01', end: '2027-06-30', createdAt: '2026-12-01T00:00:00Z' })

  it('그 달을 포함하는 승인 계획을 고른다(나중 생성 계획이 있어도)', () => {
    expect(selectEvaluationPlan([h2, h1], '2026-09')?.id).toBe('A-2026H2')
    expect(selectEvaluationPlan([h2, h1], '2027-03')?.id).toBe('B-2027H1')
  })

  it('달 경계 — 종료일은 포함, 다음 계획 시작 달에는 다음 계획', () => {
    expect(selectEvaluationPlan([h2, h1], '2026-12')?.id).toBe('A-2026H2')
    expect(selectEvaluationPlan([h2, h1], '2027-01')?.id).toBe('B-2027H1')
  })

  it('이미 쓴 평가가 참조하는 계획(anchor)이 우선 — 쓸 때의 계획에 고정', () => {
    expect(selectEvaluationPlan([h2, h1], '2027-03', 'A-2026H2')?.id).toBe('A-2026H2')
  })

  it('anchor 는 상태 무관(이의신청 중 등)이지만, 새 기준 선택엔 승인 계획만 쓴다', () => {
    const appeal = plan({ id: 'C-appeal', status: 'under_appeal', start: '2026-07-01', end: '2026-12-31' })
    expect(selectEvaluationPlan([appeal, h1], '2026-09', 'C-appeal')?.id).toBe('C-appeal')
    expect(selectEvaluationPlan([appeal, h1], '2026-09')?.id).toBe('B-2027H1') // 겹치는 승인 계획 없음 → 최근 승인
  })

  it('기간을 아는 계획이 기간 모르는 계획보다 우선(모르는 계획은 모든 달을 덮는 것처럼 보이므로)', () => {
    const unknown = plan({ id: 'U', createdAt: '2027-01-01T00:00:00Z' })
    expect(selectEvaluationPlan([unknown, h2], '2026-09')?.id).toBe('A-2026H2')
  })

  it('승인 계획이 없고 anchor 도 없으면 null', () => {
    expect(selectEvaluationPlan([plan({ id: 'D', status: 'draft' })], '2026-09')).toBeNull()
    expect(selectEvaluationPlan([], '2026-09')).toBeNull()
  })

  it('겹치는 계획이 없으면 가장 최근 승인 계획', () => {
    expect(selectEvaluationPlan([h2, h1], '2028-01')?.id).toBe('B-2027H1')
  })
})
