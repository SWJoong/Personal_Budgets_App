'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { recordSettlement, type SettlementRow } from '@/app/actions/settlement'
import type { SettlementLedger, SettlementLedgerTotals } from '@/utils/settlementLedger'

/**
 * A6 회계 보강 — 실무자 정산 원장 (행열/표). 계약: SettlementsLedgerClient.money.test.tsx.
 * 설계출처: Plan&Source/goala_supporter_accounting_W.md §2 A6.
 *
 * 담당 당사자의 정산(인정/반려/환수/미사용)을 전체 요약 + 참여자 그룹헤더 + 정산행(표)으로 보여준다.
 * 기록/수정은 관리자 전용(recordSettlement=assertAdmin·RLS seoul_is_admin). isAdmin 일 때만 각 정산행을
 * 표 안에서 바로 인라인 편집(사용자 결정 2026-09-25: "표에 인라인 편집(관리자)"). 미지정(기본 false)이면
 * 열람 전용 — money 계약 테스트는 isAdmin 없이 렌더하므로 표시는 그대로다. 금액은 정본 MoneyText.
 */

const AMOUNT_FIELDS: { key: keyof SettlementLedgerTotals; label: string }[] = [
  { key: 'accepted', label: '인정' },
  { key: 'rejected', label: '반려' },
  { key: 'recovered', label: '환수' },
  { key: 'unused', label: '미사용' },
]

/** 4금액(인정/반려/환수/미사용) 라벨+MoneyText 한 줄 — 전체/참여자 요약용. 인정만 body, 나머지 muted. */
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

export default function SettlementsLedgerClient({
  ledger,
  isAdmin = false,
}: {
  ledger: SettlementLedger
  /** 관리자면 각 정산행을 표 안에서 인라인 수정할 수 있다(recordSettlement). 기본 false = 열람 전용. */
  isAdmin?: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const colCount = isAdmin ? 7 : 6

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
      {error && <p role="alert" className="text-sm text-danger-fg font-bold">{error}</p>}

      {/* 전체 요약 */}
      <Card variant="muted" title="전체 정산 요약">
        <AmountBreakdown totals={ledger.totals} />
      </Card>

      {/* 정산 원장 표 — 참여자 그룹헤더 + 정산행(기간·인정·반려·환수·미사용·비고[·작업]) */}
      <div className="overflow-x-auto rounded-2xl ring-1 ring-border bg-card">
        <table className="w-full min-w-[40rem] text-sm border-collapse">
          <caption className="sr-only">정산 원장 표 — 참여자별 정산 기간, 인정/반려/환수/미사용 금액, 비고</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="text-left font-medium px-3 py-2 whitespace-nowrap">정산 기간</th>
              <th scope="col" className="text-right font-medium px-3 py-2">인정</th>
              <th scope="col" className="text-right font-medium px-3 py-2">반려</th>
              <th scope="col" className="text-right font-medium px-3 py-2">환수</th>
              <th scope="col" className="text-right font-medium px-3 py-2">미사용</th>
              <th scope="col" className="text-left font-medium px-3 py-2">비고</th>
              {isAdmin && <th scope="col" className="text-right font-medium px-3 py-2">작업</th>}
            </tr>
          </thead>
          <tbody>
            {ledger.participants.map((p) => (
              <Fragment key={p.participantId}>
                <tr className="bg-muted/40 border-b border-border">
                  <th scope="colgroup" colSpan={colCount} className="text-left px-3 py-2 font-bold text-foreground">
                    {p.participantName}
                  </th>
                </tr>
                {p.settlements.map((s) =>
                  isAdmin && editingId === s.id ? (
                    <SettlementEditRow
                      key={s.id}
                      settlement={s}
                      colCount={colCount}
                      onDone={() => setEditingId(null)}
                      onError={setError}
                      refresh={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={s.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{s.settled_period}</td>
                      <td className="px-3 py-2 text-right"><MoneyText value={s.accepted_amount} emphasis="body" /></td>
                      <td className="px-3 py-2 text-right"><MoneyText value={s.rejected_amount} emphasis="muted" /></td>
                      <td className="px-3 py-2 text-right"><MoneyText value={s.recovered_amount} emphasis="muted" /></td>
                      <td className="px-3 py-2 text-right"><MoneyText value={s.unused_amount} emphasis="muted" /></td>
                      <td className="px-3 py-2 text-muted-foreground">{s.note || '—'}</td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="secondary" onClick={() => { setError(''); setEditingId(s.id) }}>
                            수정
                          </Button>
                        </td>
                      )}
                    </tr>
                  ),
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SettlementEditRow({
  settlement,
  colCount,
  onDone,
  onError,
  refresh,
}: {
  settlement: SettlementRow
  colCount: number
  onDone: () => void
  onError: (msg: string) => void
  refresh: () => void
}) {
  const [accepted, setAccepted] = useState(String(settlement.accepted_amount))
  const [rejected, setRejected] = useState(String(settlement.rejected_amount))
  const [recovered, setRecovered] = useState(String(settlement.recovered_amount))
  const [unused, setUnused] = useState(String(settlement.unused_amount))
  const [note, setNote] = useState(settlement.note ?? '')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function save() {
    const nums = { accepted: Number(accepted), rejected: Number(rejected), recovered: Number(recovered), unused: Number(unused) }
    if (Object.values(nums).some((n) => !Number.isFinite(n) || n < 0)) {
      onError('금액은 0 이상의 숫자여야 해요.')
      return
    }
    onError('')
    startTransition(async () => {
      const result = await recordSettlement({
        allocationId: settlement.allocation_id,
        settledPeriod: settlement.settled_period,
        acceptedAmount: nums.accepted,
        rejectedAmount: nums.rejected,
        recoveredAmount: nums.recovered,
        unusedAmount: nums.unused,
        note: note.trim() || undefined,
      })
      if (result.error) {
        onError(result.error)
        return
      }
      onDone()
      router.refresh()
      refresh()
    })
  }

  const AMOUNTS: { label: string; value: string; set: (v: string) => void }[] = [
    { label: '인정', value: accepted, set: setAccepted },
    { label: '반려', value: rejected, set: setRejected },
    { label: '환수', value: recovered, set: setRecovered },
    { label: '미사용', value: unused, set: setUnused },
  ]

  return (
    <tr className="border-b border-border bg-muted/40">
      <td colSpan={colCount} className="px-3 py-3">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{settlement.settled_period} 정산 수정</p>
          <div className="flex flex-wrap items-end gap-2">
            {AMOUNTS.map((a) => (
              <label key={a.label} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {a.label}
                <input
                  type="number"
                  inputMode="numeric"
                  value={a.value}
                  onChange={(e) => a.set(e.target.value)}
                  aria-label={`${a.label} 금액`}
                  className="p-2 rounded-lg bg-card ring-1 ring-border text-sm text-foreground min-h-[44px] w-28"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs text-muted-foreground flex-1 min-w-[10rem]">
              비고
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="비고"
                className="p-2 rounded-lg bg-card ring-1 ring-border text-sm text-foreground min-h-[44px] w-full"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={save} disabled={pending}>
              {pending ? '저장 중...' : '저장'}
            </Button>
            <Button size="sm" variant="secondary" onClick={onDone} disabled={pending}>
              취소
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}
