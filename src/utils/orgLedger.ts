/**
 * org 거래장부 집계 — supporter/transactions(담당 당사자 전체 지출). 계약: src/utils/orgLedger.test.ts.
 * 설계: Plan&Source/goala_comingsoon_stubs_triage_W.md §5. domainAxisReport.ts 형제(순수 집계).
 *
 * 입력 OrgUsageRow 는 DB 행과 분리한다(액션이 getServiceUsages() 결과를 이 형태로 매핑). 실무자는 RLS 로
 * 자기 담당분만 조회하므로 이 함수는 "보이는 행"만 집계한다(스코프는 쿼리가 담당). 순수·결정성·부수효과 없음.
 */

export type SettlementStatus = 'pending' | 'accepted' | 'rejected' | 'recovered'

export interface OrgUsageRow {
  id: string
  participantId: string
  participantName: string
  amount: number | null
  settlementStatus: SettlementStatus | string
  usageDate: string
}

export interface OrgLedgerParticipant {
  participantId: string
  participantName: string
  total: number
  count: number
  latestDate: string | null
}

type StatusBucket = 'pending' | 'accepted' | 'rejected' | 'recovered' | 'other'

export interface OrgLedgerSummary {
  grandTotal: number
  totalCount: number
  byStatus: Record<StatusBucket, { amount: number; count: number }>
  participants: OrgLedgerParticipant[]
}

const STANDARD_STATUSES = new Set<string>(['pending', 'accepted', 'rejected', 'recovered'])

/** 표준 4버킷 외 문자열은 other 로(누락 금지, 불변식 2). */
function statusBucket(status: string): StatusBucket {
  return STANDARD_STATUSES.has(status) ? (status as StatusBucket) : 'other'
}

/**
 * 거래장부 요약 집계. 불변식(골든 §5):
 * 1) 당사자별 그룹핑(total·count, 이름 대표값) 2) 정산상태 5버킷 롤업(미지→other)
 * 3) null amount → 0(건수엔 포함) 4) participants total 내림차순 → 동률 이름 오름차순
 * 5) latestDate = 그룹 내 최신 usageDate(Date 파싱) 6) 빈 입력 → 0·빈 그룹 7) 교차 합치성(회계 무결성).
 */
export function buildOrgLedger(rows: OrgUsageRow[]): OrgLedgerSummary {
  const byStatus: Record<StatusBucket, { amount: number; count: number }> = {
    pending: { amount: 0, count: 0 },
    accepted: { amount: 0, count: 0 },
    rejected: { amount: 0, count: 0 },
    recovered: { amount: 0, count: 0 },
    other: { amount: 0, count: 0 },
  }

  const groups = new Map<string, OrgLedgerParticipant & { _latestMs: number }>()
  let grandTotal = 0
  let totalCount = 0

  for (const r of rows) {
    const amount = r.amount ?? 0
    grandTotal += amount
    totalCount += 1

    const bucket = statusBucket(r.settlementStatus)
    byStatus[bucket].amount += amount
    byStatus[bucket].count += 1

    let g = groups.get(r.participantId)
    if (!g) {
      g = {
        participantId: r.participantId,
        participantName: r.participantName,
        total: 0,
        count: 0,
        latestDate: null,
        _latestMs: -Infinity,
      }
      groups.set(r.participantId, g)
    }
    g.total += amount
    g.count += 1
    const ms = Date.parse(r.usageDate)
    if (!Number.isNaN(ms) && ms > g._latestMs) {
      g._latestMs = ms
      g.latestDate = r.usageDate
    }
  }

  const participants: OrgLedgerParticipant[] = [...groups.values()]
    .map((g) => ({
      participantId: g.participantId,
      participantName: g.participantName,
      total: g.total,
      count: g.count,
      latestDate: g.latestDate,
    }))
    .sort((a, b) => b.total - a.total || a.participantName.localeCompare(b.participantName))

  return { grandTotal, totalCount, byStatus, participants }
}
