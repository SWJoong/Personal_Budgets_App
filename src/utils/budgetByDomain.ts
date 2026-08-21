/**
 * 예산(계획↔집행) 영역별 집계 — 순수 로직. 서버/클라이언트 공용, 테스트 가능.
 * 설계: Plan&Source/goala_budget_screen_ux_W.md §7. 골든: budgetByDomain.test.ts.
 *
 * GOAL축 A 예산 화면의 "돈" 뷰. domainAxisReport(사정→지출 2축)의 형제로, 여기에 **계획** 축을 더한다.
 * 계획 vs 집행을 같은 domain_id 축에서 나란히 놓아, 영역별로 계획대로 쓰고 있는지 담당자·당사자가 본다.
 *
 * 두 가지 그레인 불변식(어기면 손실·오염 집계):
 *  - §8-5 그레인: 영역별 계획금액은 requested_services 그레인(Σ estimated_cost by domain)이다.
 *    budget_allocations.domain_id 는 UNIQUE(plan_id)라 플랜당 1행 → 영역별로 쓰면 손실집계.
 *    그래서 같은 domain_id 의 계획 여러 행을 반드시 합산한다.
 *  - §8-4 id 조인: 계획·집행 모두 domain_id 로 스파인에 귀속한다. 라벨은 program(seoul·mohw) 스코프라
 *    동명 도메인('일상생활' 등)이 라벨로 섞이면 금액이 조용히 오염된다.
 */

import type { DomainSpine, DomainFlowRow } from './domainAxisReport'

/** requested_services 최소 행(영역별 계획금액 원천, §8-5 그레인). */
export interface PlannedServiceRow {
  domain_id: string | null
  estimated_cost: number | null
}

export type BudgetStatus = 'ok' | 'over' | 'unused' | 'unplanned' | 'none'

export interface BudgetDomainRow {
  domainId: string
  label: string
  plannedSum: number // Σ estimated_cost by domain (requested_services 그레인, §8-5)
  usageSum: number // v_seoul_domain_flow 금액
  remaining: number // plannedSum − usageSum (영역 레벨)
  unplannedSum: number // 계획외 지출 금액
  status: BudgetStatus
}

/**
 * 계획 vs 집행 판정. 음수 집행은 0 으로 취급하고, 경계(집행==계획)는 초과가 아니라 ok 다.
 *   planned>0 & 0<usage<=planned → ok / usage>planned → over / usage<=0 → unused
 *   planned<=0 & usage>0 → unplanned / 둘 다<=0 → none
 */
export function budgetStatus(plannedSum: number, usageSum: number): BudgetStatus {
  const usage = usageSum > 0 ? usageSum : 0 // 음수 집행은 0
  if (plannedSum > 0) {
    if (usage <= 0) return 'unused'
    if (usage > plannedSum) return 'over'
    return 'ok' // 0 < usage <= plannedSum
  }
  return usage > 0 ? 'unplanned' : 'none'
}

const STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: '쓰는 중이에요',
  over: '계획보다 많이 썼어요',
  unused: '아직 안 썼어요',
  unplanned: '계획에 없던 지출',
  none: '해당 없음',
}

/** 상태 배지 쉬운 말(당사자용, §5). */
export function budgetStatusLabel(status: BudgetStatus): string {
  return STATUS_LABEL[status]
}

/**
 * 도메인 스파인 + 계획(requested_services) + 집행뷰(v_seoul_domain_flow) → 영역별 계획↔집행 행.
 * 스파인 순서(sort_order)를 유지하고 6영역 모두 포함(집계 0 인 영역도 행 존재).
 * 계획·집행 모두 domain_id 로 귀속하며, domain_id=null 인 행은 어떤 영역에도 붙지 않는다(미분류 별도).
 */
export function buildBudgetByDomain(
  domains: DomainSpine[],
  planned: PlannedServiceRow[],
  flow: DomainFlowRow[]
): BudgetDomainRow[] {
  // 계획: domain_id 로 group, Σ estimated_cost (null→0, 같은 domain 여러 행 합산 — §8-5)
  const plannedByDomainId = new Map<string, number>()
  for (const p of planned) {
    if (p.domain_id == null) continue // 미분류 계획은 어떤 영역에도 안 붙음
    plannedByDomainId.set(p.domain_id, (plannedByDomainId.get(p.domain_id) ?? 0) + Number(p.estimated_cost ?? 0))
  }
  // 집행: v_seoul_domain_flow 를 domain_id 로 조회(라벨 조인 금지 — §8-4, null 은 스킵)
  const flowById = new Map<string, DomainFlowRow>()
  for (const f of flow) {
    if (f.domain_id != null) flowById.set(f.domain_id, f)
  }

  return [...domains]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => {
      const plannedSum = plannedByDomainId.get(d.id) ?? 0
      const f = flowById.get(d.id)
      const usageSum = Number(f?.금액 ?? 0)
      const unplannedSum = Number(f?.계획외_금액 ?? 0)
      return {
        domainId: d.id,
        label: d.label,
        plannedSum,
        usageSum,
        remaining: plannedSum - usageSum,
        unplannedSum,
        status: budgetStatus(plannedSum, usageSum),
      }
    })
}
