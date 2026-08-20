/**
 * 분류축 교차집계(사정→지출) — 순수 로직. 서버/클라이언트 공용, 테스트 가능.
 *
 * GOAL축 B 의 핵심: 같은 지원영역(domain) 축에서 "무엇을 욕구로 사정했나(needs_assessment)"와
 * "실제로 무엇에 썼나(service_usages)"를 나란히 놓아, 욕구와 지출의 어긋남을 담당자가 본다.
 * 지출 집계는 기존 뷰 v_seoul_domain_flow(도메인별 건수·금액)를 재활용한다.
 */

/** 대분류 스파인(서울형 6). */
export interface DomainSpine {
  id: string
  label: string
  sort_order: number
}

/**
 * v_seoul_domain_flow 한 행(참여자별 도메인 지출 집계).
 * 조인 키는 domain_id(전역 유일 UUID) — 영역(라벨)은 표시·디버그용이다. 분류 참조테이블이
 * program 스코프(seoul·mohw 병존)라 라벨('일상생활' 등)이 프로그램 간 충돌하므로, 라벨로 조인하면
 * 다른 도메인의 지출을 조용히 합치거나 엉뚱한 행에 귀속시킨다(스펙 §8-4).
 */
export interface DomainFlowRow {
  domain_id: string | null
  program?: string | null
  영역: string
  건수: number | null
  금액: number | null
  계획외_금액?: number | null
}

/** needs_assessment 최소 행(도메인만). */
export interface NeedsRow {
  domain_id: string
}

export type AxisStatus = 'ok' | 'unmet' | 'unplanned' | 'none'

export interface DomainAxisRow {
  domainId: string
  label: string
  needsCount: number // 사정 건수
  usageCount: number // 지출 건수
  usageSum: number // 지출 금액
  unplannedSum: number // 계획 밖 지출 금액
  status: AxisStatus
}

/** 교차 신호 판정: 욕구와 지출의 어긋남을 한눈에. */
export function axisStatus(needsCount: number, usageSum: number): AxisStatus {
  if (needsCount > 0 && usageSum <= 0) return 'unmet' // 욕구는 사정됐으나 아직 지출 없음
  if (needsCount <= 0 && usageSum > 0) return 'unplanned' // 사정 없이 지출 발생
  if (needsCount <= 0 && usageSum <= 0) return 'none'
  return 'ok'
}

const STATUS_LABEL: Record<AxisStatus, string> = {
  ok: '진행 중',
  unmet: '욕구 있으나 아직 안 씀',
  unplanned: '사정 없이 지출',
  none: '해당 없음',
}

/** 화면용 상태 라벨(쉬운 말). */
export function axisStatusLabel(status: AxisStatus): string {
  return STATUS_LABEL[status]
}

/**
 * 도메인 스파인 + 지출뷰 + 사정행 → 도메인별 교차 행(스파인 순서 유지, 6개 모두 포함).
 * 사정도 지출도 domain_id 로 집계해 같은 domain_id 로 만난다(라벨 조인 금지 — 스펙 §8-4).
 */
export function buildDomainAxisReport(
  domains: DomainSpine[],
  flowRows: DomainFlowRow[],
  needsRows: NeedsRow[]
): DomainAxisRow[] {
  const needsByDomainId = new Map<string, number>()
  for (const n of needsRows) {
    needsByDomainId.set(n.domain_id, (needsByDomainId.get(n.domain_id) ?? 0) + 1)
  }
  const flowById = new Map<string, DomainFlowRow>()
  for (const f of flowRows) {
    if (f.domain_id != null) flowById.set(f.domain_id, f)
  }

  return [...domains]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => {
      const needsCount = needsByDomainId.get(d.id) ?? 0
      const flow = flowById.get(d.id)
      const usageSum = Number(flow?.금액 ?? 0)
      const usageCount = Number(flow?.건수 ?? 0)
      const unplannedSum = Number(flow?.계획외_금액 ?? 0)
      return {
        domainId: d.id,
        label: d.label,
        needsCount,
        usageCount,
        usageSum,
        unplannedSum,
        status: axisStatus(needsCount, usageSum),
      }
    })
}
