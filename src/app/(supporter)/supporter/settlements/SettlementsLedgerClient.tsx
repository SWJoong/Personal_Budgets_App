import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SettlementLedger, SettlementLedgerTotals } from '@/utils/settlementLedger'

/**
 * A6 회계 보강 — 실무자 정산 원장 (표현, 열람 전용). 계약: SettlementsLedgerClient.money.test.tsx.
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A6.
 *
 * 담당 당사자의 정산(인정/반려/환수/미사용)을 전체 요약 + 참여자별 그룹으로 보여준다. 기록은 관리자
 * 전용이라 여기서는 뮤테이션이 없다. 모든 금액은 정본 MoneyText(§8·§9 통일)로 렌더한다.
 */

const AMOUNT_FIELDS: { key: keyof SettlementLedgerTotals; label: string }[] = [
  { key: 'accepted', label: '인정' },
  { key: 'rejected', label: '반려' },
  { key: 'recovered', label: '환수' },
  { key: 'unused', label: '미사용' },
]

/** 4금액(인정/반려/환수/미사용) 라벨+MoneyText 한 줄. 인정만 body, 나머지 muted. */
function AmountBreakdown({ totals }: { totals: SettlementLedgerTotals }) {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1">
      {AMOUNT_FIELDS.map((f) => (
        <div key={f.key} className="flex items-baseline gap-1.5">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className="text-sm">
            <MoneyText value={totals[f.key]} emphasis={f.key === 'accepted' ? 'body' : 'muted'} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function SettlementsLedgerClient({ ledger }: { ledger: SettlementLedger }) {
  if (ledger.participants.length === 0) {
    return (
      <EmptyState
        emoji="🧾"
        title="아직 정산 기록이 없어요."
        description="담당 당사자의 정산이 등록되면 여기에서 볼 수 있어요."
        variant="inline"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 전체 요약 */}
      <Card variant="muted" title="전체 정산 요약">
        <AmountBreakdown totals={ledger.totals} />
      </Card>

      {/* 참여자별 그룹 */}
      <ul className="flex flex-col gap-3">
        {ledger.participants.map((p) => (
          <li key={p.participantId}>
            <Card as="article" title={p.participantName}>
              <AmountBreakdown totals={p.totals} />

              <ul className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                {p.settlements.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">{s.settled_period}</span>
                    <AmountBreakdown
                      totals={{
                        accepted: s.accepted_amount,
                        rejected: s.rejected_amount,
                        recovered: s.recovered_amount,
                        unused: s.unused_amount,
                      }}
                    />
                    {s.note && <p className="text-xs leading-relaxed text-muted-foreground">{s.note}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
