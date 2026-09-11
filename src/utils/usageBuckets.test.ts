import { describe, it, expect } from 'vitest'
import { bucketUsages, type UsageForBucket } from './usageBuckets'

/**
 * 예산 실행 통합 뷰 #4 — 사용내역 시간버킷 util 골든 계약 (W 레인).
 * 설계출처: Plan&Source/goala_budget_execution_view_W.md §1.
 * 구현 대상: src/utils/usageBuckets.ts (순수 함수).
 *
 * bucketUsages(usages, mode) 가 건/일/주/월로 그룹핑. 결정성 위해 month/day/item 은 정확 그룹핑,
 * 주(ISO week)는 계산 결정성이 캘린더 의존이라 불변식(금액 보존·coarseness)으로 못박는다.
 */

const usages: UsageForBucket[] = [
  { id: 'u1', usage_date: '2026-09-01', amount: 10000 },
  { id: 'u2', usage_date: '2026-09-01', amount: 5000 },
  { id: 'u3', usage_date: '2026-09-15', amount: 20000 },
  { id: 'u4', usage_date: '2026-08-20', amount: 8000 },
]
const GRAND = 43000

function sum(mode: Parameters<typeof bucketUsages>[1]) {
  return bucketUsages(usages, mode).reduce((s, b) => s + b.total, 0)
}

describe('bucketUsages — 사용내역 시간버킷 (#4)', () => {
  it('빈 입력 → 빈 배열', () => {
    expect(bucketUsages([], 'month')).toEqual([])
    expect(bucketUsages([], 'day')).toEqual([])
  })

  it('금액 보존: 모든 모드에서 Σ버킷.total = Σusage.amount', () => {
    for (const mode of ['item', 'day', 'week', 'month'] as const) {
      expect(sum(mode)).toBe(GRAND)
    }
  })

  it('item(건별): usage 1건 = 버킷 1', () => {
    const b = bucketUsages(usages, 'item')
    expect(b).toHaveLength(4)
    expect(b.every((x) => x.count === 1 && x.items.length === 1)).toBe(true)
  })

  it('month(월별): 같은 달을 한 버킷으로·최신 먼저', () => {
    const b = bucketUsages(usages, 'month')
    expect(b).toHaveLength(2)
    // 최신(2026-09) 먼저
    expect(b[0].key).toBe('2026-09')
    const sep = b.find((x) => x.key === '2026-09')!
    const aug = b.find((x) => x.key === '2026-08')!
    expect(sep.count).toBe(3)
    expect(sep.total).toBe(35000)
    expect(aug.count).toBe(1)
    expect(aug.total).toBe(8000)
  })

  it('day(일별): 같은 날을 한 버킷으로', () => {
    const b = bucketUsages(usages, 'day')
    expect(b).toHaveLength(3)
    const d1 = b.find((x) => x.key === '2026-09-01')!
    expect(d1.count).toBe(2)
    expect(d1.total).toBe(15000)
  })

  it('week(주별): 버킷 수가 월(coarse)과 일(fine) 사이', () => {
    const w = bucketUsages(usages, 'week').length
    const d = bucketUsages(usages, 'day').length
    const m = bucketUsages(usages, 'month').length
    expect(w).toBeGreaterThanOrEqual(m)
    expect(w).toBeLessThanOrEqual(d)
  })
})
