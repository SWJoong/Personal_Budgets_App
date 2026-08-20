import { describe, it, expect } from 'vitest'
import { axisStatus, axisStatusLabel, buildDomainAxisReport, type DomainFlowRow } from './domainAxisReport'

/**
 * 분류축 교차집계(사정→지출) 골든 — GOAL축 B.
 * 순수함수라 DB·렌더 없이 판정 로직·조인·정규화를 못박는다.
 *
 * ★ 조인 계약 (test-first, W): 지출은 라벨이 아니라 domain_id 로 스파인에 귀속한다.
 *   분류 참조테이블이 program 스코프(seoul·mohw 병존, 스펙 §2)라 '일상생활'·'주거' 등
 *   라벨이 프로그램 간에 충돌한다. 라벨 조인은 서로 다른 도메인의 지출을 조용히 합치거나
 *   엉뚱한 스파인 행에 귀속시킨다(에러 없이 금액이 오염된다). 그래서 v_seoul_domain_flow 가
 *   domain_id 를 내고, 여기서 사정·지출을 같은 domain_id 로 만난다.
 *   → U: 뷰가 domain_id(+program)를 emit 하고 buildDomainAxisReport 가 id 로 조인하면 green.
 */

describe('axisStatus — 교차 신호 판정', () => {
  it('욕구만 사정, 지출 없음 → unmet', () => expect(axisStatus(2, 0)).toBe('unmet'))
  it('사정 없이 지출만 → unplanned', () => expect(axisStatus(0, 5000)).toBe('unplanned'))
  it('둘 다 없음 → none', () => expect(axisStatus(0, 0)).toBe('none'))
  it('욕구·지출 모두 있음 → ok', () => expect(axisStatus(1, 5000)).toBe('ok'))
  it('경계: 음수/0 지출은 "지출 없음"으로 취급', () => {
    expect(axisStatus(1, 0)).toBe('unmet')
    expect(axisStatus(1, -10)).toBe('unmet')
  })
})

describe('axisStatusLabel — 쉬운 말 라벨', () => {
  it('상태별 라벨', () => {
    expect(axisStatusLabel('ok')).toBe('진행 중')
    expect(axisStatusLabel('unmet')).toBe('욕구 있으나 아직 안 씀')
    expect(axisStatusLabel('unplanned')).toBe('사정 없이 지출')
    expect(axisStatusLabel('none')).toBe('해당 없음')
  })
})

describe('buildDomainAxisReport — 사정↔지출 교차집계 (domain_id 조인)', () => {
  // 지출 뷰(v_seoul_domain_flow) 한 행. 조인 키 domain_id 는 필수, 영역(라벨)은 표시·디버그용.
  type Flow = DomainFlowRow & { domain_id: string }

  const domains = [
    { id: 'd-daily', label: '일상생활', sort_order: 1 },
    { id: 'd-social', label: '사회생활', sort_order: 2 },
    { id: 'd-health', label: '건강·안전', sort_order: 3 },
    { id: 'd-house', label: '주거환경개선', sort_order: 4 },
  ]

  it('데이터가 없어도 모든 도메인을 스파인 순서로 포함(전부 none)', () => {
    const rows = buildDomainAxisReport(domains, [], [])
    expect(rows.map((r) => r.domainId)).toEqual(['d-daily', 'd-social', 'd-health', 'd-house'])
    expect(rows.every((r) => r.status === 'none')).toBe(true)
  })

  it('사정도 지출도 domain_id 로 조인해 네 상태를 낸다', () => {
    const needs = [{ domain_id: 'd-daily' }, { domain_id: 'd-daily' }, { domain_id: 'd-social' }]
    const flow: Flow[] = [
      { domain_id: 'd-daily', 영역: '일상생활', 건수: 3, 금액: 45000, 계획외_금액: 0 }, // 욕구2 + 지출 → ok
      { domain_id: 'd-health', 영역: '건강·안전', 건수: 1, 금액: 10000 }, //                지출만 → unplanned
    ]
    const rows = buildDomainAxisReport(domains, flow, needs)
    const byId = Object.fromEntries(rows.map((r) => [r.domainId, r]))

    expect(byId['d-daily']).toMatchObject({ needsCount: 2, usageCount: 3, usageSum: 45000, status: 'ok' })
    expect(byId['d-social']).toMatchObject({ needsCount: 1, usageSum: 0, status: 'unmet' })
    expect(byId['d-health']).toMatchObject({ needsCount: 0, usageSum: 10000, status: 'unplanned' })
    expect(byId['d-house']).toMatchObject({ needsCount: 0, usageSum: 0, status: 'none' })
  })

  it('null/누락 금액·건수를 0으로 강제하고 계획외 금액을 노출한다', () => {
    const flow: Flow[] = [{ domain_id: 'd-daily', 영역: '일상생활', 건수: null, 금액: null, 계획외_금액: 20000 }]
    const [row] = buildDomainAxisReport([domains[0]], flow, [{ domain_id: 'd-daily' }])
    expect(row.usageSum).toBe(0)
    expect(row.usageCount).toBe(0)
    expect(row.unplannedSum).toBe(20000)
    expect(row.status).toBe('unmet') // 욕구 있고 지출 0
  })

  it('스파인에 없는 domain_id 지출 행은 무시된다', () => {
    const flow: Flow[] = [{ domain_id: 'd-미존재', 영역: '없는영역', 건수: 1, 금액: 9999 }]
    const rows = buildDomainAxisReport(domains, flow, [])
    expect(rows.every((r) => r.usageSum === 0)).toBe(true)
  })

  // ★ 라벨 조인의 실패를 못박는 회귀 (test-first RED → U 가 domain_id 조인으로 green).
  it('라벨이 겹치는 다른 프로그램 도메인 지출을 라벨이 아니라 domain_id 로 귀속한다', () => {
    // seoul '일상생활'(d-daily) 과 mohw '일상생활'(m-daily) 은 라벨이 같다(스펙 §2 병존).
    // 스파인은 seoul d-daily 만 — mohw 지출은 이 행에 섞이면 안 된다.
    const spine = [{ id: 'd-daily', label: '일상생활', sort_order: 1 }]
    const flow: Flow[] = [
      { domain_id: 'd-daily', 영역: '일상생활', 건수: 1, 금액: 10000 }, // seoul → 이 행에 귀속
      { domain_id: 'm-daily', 영역: '일상생활', 건수: 1, 금액: 99999 }, // mohw 동일 라벨 → 귀속 금지
    ]
    const [row] = buildDomainAxisReport(spine, flow, [])
    // 라벨 조인이면 같은 '일상생활' 키로 두 행이 충돌해 금액이 오염된다. id 조인이면 seoul 만.
    expect(row.usageSum).toBe(10000)
    expect(row.usageCount).toBe(1)
  })

  it('정렬 안 된 도메인 입력도 sort_order 순으로 정렬한다', () => {
    const shuffled = [domains[2], domains[0], domains[3], domains[1]]
    const rows = buildDomainAxisReport(shuffled, [], [])
    expect(rows.map((r) => r.domainId)).toEqual(['d-daily', 'd-social', 'd-health', 'd-house'])
  })
})
