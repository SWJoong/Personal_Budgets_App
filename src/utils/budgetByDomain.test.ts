import { describe, it, expect } from 'vitest'
import {
  budgetStatus,
  budgetStatusLabel,
  buildBudgetByDomain,
  type PlannedServiceRow,
} from './budgetByDomain'
import type { DomainFlowRow } from './domainAxisReport'

/**
 * 예산(계획↔집행) 영역별 집계 골든 — GOAL축 A 예산 화면.
 * 설계: Plan&Source/goala_budget_screen_ux_W.md §7. 순수함수라 DB·렌더 없이 §8-5 그레인을 못박는다.
 *
 * ★ 이 골든은 test-first(W)로 RED 다 — src/utils/budgetByDomain.ts 가 아직 없다.
 *   U 가 buildBudgetByDomain 을 구현하면 green. 다음 두 불변식이 핵심이다:
 *
 *   (1) §8-5 그레인: 영역별 계획금액은 requested_services 그레인(Σ estimated_cost by domain)이다.
 *       budget_allocations.domain_id 는 UNIQUE(plan_id)라 플랜당 1행 → 영역별로 쓰면 손실집계.
 *       그래서 같은 domain_id 의 계획 2행이 반드시 합산돼야 한다.
 *   (2) §8-4 id 조인: 계획·집행 모두 domain_id 로 스파인에 귀속한다. 라벨은 program(seoul·mohw)
 *       스코프라 동명 도메인이 섞이면 금액이 조용히 오염된다.
 */

describe('budgetStatus — 계획 vs 집행 판정', () => {
  it('계획 있고 집행이 계획 내 → ok', () => expect(budgetStatus(10000, 5000)).toBe('ok'))
  it('집행이 계획 초과 → over', () => expect(budgetStatus(10000, 15000)).toBe('over'))
  it('계획 있고 집행 0 → unused', () => expect(budgetStatus(10000, 0)).toBe('unused'))
  it('계획 없이 집행만 → unplanned', () => expect(budgetStatus(0, 5000)).toBe('unplanned'))
  it('둘 다 없음 → none', () => expect(budgetStatus(0, 0)).toBe('none'))
  it('경계: 집행==계획 은 초과 아님(ok)', () => expect(budgetStatus(10000, 10000)).toBe('ok'))
  it('경계: 음수 집행은 0으로 취급(unused)', () => expect(budgetStatus(10000, -5)).toBe('unused'))
})

describe('budgetStatusLabel — 쉬운 말 배지', () => {
  it('상태별 라벨', () => {
    expect(budgetStatusLabel('ok')).toBe('쓰는 중이에요')
    expect(budgetStatusLabel('over')).toBe('계획보다 많이 썼어요')
    expect(budgetStatusLabel('unused')).toBe('아직 안 썼어요')
    expect(budgetStatusLabel('unplanned')).toBe('계획에 없던 지출')
    expect(budgetStatusLabel('none')).toBe('해당 없음')
  })
})

describe('buildBudgetByDomain — 영역별 계획↔집행 집계 (domain_id 조인)', () => {
  type Flow = DomainFlowRow & { domain_id: string }

  const domains = [
    { id: 'd-daily', label: '일상생활', sort_order: 1 },
    { id: 'd-social', label: '사회생활', sort_order: 2 },
    { id: 'd-health', label: '건강·안전', sort_order: 3 },
    { id: 'd-house', label: '주거환경개선', sort_order: 4 },
  ]

  it('데이터가 없어도 모든 도메인을 스파인 순서로 포함(전부 none·0)', () => {
    const rows = buildBudgetByDomain(domains, [], [])
    expect(rows.map((r) => r.domainId)).toEqual(['d-daily', 'd-social', 'd-health', 'd-house'])
    expect(rows.every((r) => r.plannedSum === 0 && r.usageSum === 0 && r.remaining === 0)).toBe(true)
    expect(rows.every((r) => r.status === 'none')).toBe(true)
  })

  // ★ §8-5 그레인 잠금: 같은 domain 의 계획 2행이 합산돼야 한다(플랜당 1행 배정으로 착각 금지).
  it('같은 domain_id 의 요청서비스 여러 행을 합산한다(requested_services 그레인)', () => {
    const planned: PlannedServiceRow[] = [
      { domain_id: 'd-daily', estimated_cost: 10000 },
      { domain_id: 'd-daily', estimated_cost: 5000 }, // 같은 영역 2번째 항목
    ]
    const flow: Flow[] = [{ domain_id: 'd-daily', 영역: '일상생활', 건수: 1, 금액: 5000, 계획외_금액: 0 }]
    const [row] = buildBudgetByDomain([domains[0]], planned, flow)
    expect(row.plannedSum).toBe(15000) // 10000 + 5000 — 합산되지 않으면 §8-5 위반
    expect(row.usageSum).toBe(5000)
    expect(row.remaining).toBe(10000) // 15000 - 5000
    expect(row.status).toBe('ok')
  })

  it('영역별 네 상태(ok·unused·over·unplanned)를 계획 vs 집행으로 낸다', () => {
    const planned: PlannedServiceRow[] = [
      { domain_id: 'd-daily', estimated_cost: 15000 }, // 집행 5000 → ok
      { domain_id: 'd-social', estimated_cost: 8000 }, // 집행 0    → unused
      { domain_id: 'd-health', estimated_cost: 10000 }, // 집행 12000 → over
      // d-house 계획 없음, 집행만 → unplanned
    ]
    const flow: Flow[] = [
      { domain_id: 'd-daily', 영역: '일상생활', 건수: 1, 금액: 5000, 계획외_금액: 0 },
      { domain_id: 'd-health', 영역: '건강·안전', 건수: 2, 금액: 12000, 계획외_금액: 0 },
      { domain_id: 'd-house', 영역: '주거환경개선', 건수: 1, 금액: 3000, 계획외_금액: 3000 },
    ]
    const rows = buildBudgetByDomain(domains, planned, flow)
    const byId = Object.fromEntries(rows.map((r) => [r.domainId, r]))

    expect(byId['d-daily']).toMatchObject({ plannedSum: 15000, usageSum: 5000, remaining: 10000, status: 'ok' })
    expect(byId['d-social']).toMatchObject({ plannedSum: 8000, usageSum: 0, remaining: 8000, status: 'unused' })
    expect(byId['d-health']).toMatchObject({ plannedSum: 10000, usageSum: 12000, remaining: -2000, status: 'over' })
    expect(byId['d-house']).toMatchObject({ plannedSum: 0, usageSum: 3000, remaining: -3000, status: 'unplanned', unplannedSum: 3000 })
  })

  it('null estimated_cost·금액을 0으로 강제한다', () => {
    const planned: PlannedServiceRow[] = [
      { domain_id: 'd-daily', estimated_cost: null },
      { domain_id: 'd-daily', estimated_cost: 12000 },
    ]
    const flow: Flow[] = [{ domain_id: 'd-daily', 영역: '일상생활', 건수: null, 금액: null, 계획외_금액: null }]
    const [row] = buildBudgetByDomain([domains[0]], planned, flow)
    expect(row.plannedSum).toBe(12000) // null 은 0
    expect(row.usageSum).toBe(0)
    expect(row.unplannedSum).toBe(0)
    expect(row.status).toBe('unused')
  })

  // ★ §8-4 id 조인 잠금: 라벨 겹치는 다른 프로그램 도메인이 섞이면 안 된다.
  it('라벨이 겹치는 다른 프로그램 도메인을 라벨이 아니라 domain_id 로 귀속한다', () => {
    const spine = [{ id: 'd-daily', label: '일상생활', sort_order: 1 }] // seoul 일상생활만
    const planned: PlannedServiceRow[] = [
      { domain_id: 'd-daily', estimated_cost: 10000 }, // seoul → 귀속
      { domain_id: 'm-daily', estimated_cost: 77777 }, // mohw 동일 라벨 → 귀속 금지
    ]
    const flow: Flow[] = [
      { domain_id: 'd-daily', 영역: '일상생활', 건수: 1, 금액: 4000, 계획외_금액: 0 },
      { domain_id: 'm-daily', 영역: '일상생활', 건수: 1, 금액: 99999, 계획외_금액: 0 },
    ]
    const [row] = buildBudgetByDomain(spine, planned, flow)
    expect(row.plannedSum).toBe(10000) // 라벨 조인이면 87777 로 오염
    expect(row.usageSum).toBe(4000) //  라벨 조인이면 103999 로 오염
  })

  it('domain_id 가 null 인 계획·집행 행은 어떤 영역에도 붙지 않는다(미분류)', () => {
    const planned: PlannedServiceRow[] = [{ domain_id: null, estimated_cost: 50000 }]
    // DomainFlowRow.domain_id 는 string|null — 미분류(null) 집행행이 뷰에 존재할 수 있다.
    const flow: DomainFlowRow[] = [
      { domain_id: 'd-daily', 영역: '일상생활', 건수: 1, 금액: 1000, 계획외_금액: 0 },
      { domain_id: null, 영역: '(영역 미분류)', 건수: 1, 금액: 9999, 계획외_금액: 0 },
    ]
    const rows = buildBudgetByDomain(domains, planned, flow)
    expect(rows.reduce((s, r) => s + r.plannedSum, 0)).toBe(0) // null 계획 50000 는 미포함
    expect(rows.reduce((s, r) => s + r.usageSum, 0)).toBe(1000) // null 집행 9999 는 미포함
  })

  it('정렬 안 된 도메인 입력도 sort_order 순으로 정렬한다', () => {
    const shuffled = [domains[2], domains[0], domains[3], domains[1]]
    const rows = buildBudgetByDomain(shuffled, [], [])
    expect(rows.map((r) => r.domainId)).toEqual(['d-daily', 'd-social', 'd-health', 'd-house'])
  })
})
