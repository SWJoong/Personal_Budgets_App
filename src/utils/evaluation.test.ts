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
