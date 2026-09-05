'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LinkButton } from '@/components/ui/LinkButton'
import { buildOrgLedger, type OrgUsageRow } from '@/utils/orgLedger'
import { settlementLabel, settlementIntent } from '@/utils/settlementStatus'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { EmptyState } from '@/components/ui/EmptyState'

/** org 원장 한 행 — buildOrgLedger 입력(OrgUsageRow) + 펼침 표시용 description. */
export interface LedgerRow extends OrgUsageRow {
  description: string | null
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '정산 대기' },
  { value: 'accepted', label: '정산 완료' },
  { value: 'rejected', label: '반려' },
  { value: 'recovered', label: '환수' },
]

const CHIPS: { key: 'pending' | 'accepted' | 'rejected' | 'recovered'; label: string }[] = [
  { key: 'pending', label: '대기' },
  { key: 'accepted', label: '완료' },
  { key: 'rejected', label: '반려' },
  { key: 'recovered', label: '환수' },
]

/**
 * org 거래장부 — 요약 바 + 정산상태 필터 + 당사자별 그룹(펼치면 최근 지출). 설계 §4-1.
 * 집계는 순수 util buildOrgLedger 를 필터된 행에 클라이언트에서 돌린다(필터 즉시 반영).
 */
export default function OrgLedgerClient({ rows }: { rows: LedgerRow[] }) {
  const [status, setStatus] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = status === 'all' ? rows : rows.filter((r) => r.settlementStatus === status)
  const ledger = buildOrgLedger(filtered)

  // 펼침용 — 당사자별 최근 지출(원본 순서 = usage_date 내림차순).
  const byParticipant = new Map<string, LedgerRow[]>()
  for (const r of filtered) {
    const arr = byParticipant.get(r.participantId)
    if (arr) arr.push(r)
    else byParticipant.set(r.participantId, [r])
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ① 요약 바 */}
      <Card variant="muted" className="flex flex-col gap-2">
        <div>
          <span className="text-xs text-muted-foreground">전체 지출</span>
          <p className="text-2xl font-bold">
            <MoneyText value={ledger.grandTotal} emphasis="hero" />
          </p>
          <p className="text-xs text-muted-foreground">{ledger.totalCount}건</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <StatusPill
              key={c.key}
              label={`${c.label} ${ledger.byStatus[c.key].count}`}
              intent={settlementIntent(c.key)}
            />
          ))}
          {ledger.byStatus.other.count > 0 && (
            <StatusPill label={`기타 ${ledger.byStatus.other.count}`} intent="neutral" />
          )}
        </div>
      </Card>

      {/* ② 정산상태 필터 */}
      <div role="group" aria-label="정산 상태로 거르기" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value
          return (
            <Button
              key={f.value}
              onClick={() => setStatus(f.value)}
              aria-pressed={active}
              variant={active ? 'primary' : 'secondary'}
              size="sm"
            >
              {f.label}
            </Button>
          )
        })}
      </div>

      {/* ③ 당사자별 그룹 */}
      {ledger.participants.length === 0 ? (
        <EmptyState emoji="📭" title="해당하는 지출이 없어요." description="조건을 바꿔서 다시 찾아보세요." variant="inline" />
      ) : (
        <ul className="flex flex-col gap-2">
          {ledger.participants.map((p) => {
            const isOpen = expanded === p.participantId
            const recent = (byParticipant.get(p.participantId) ?? []).slice(0, 5)
            return (
              <li key={p.participantId} className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-4">
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.participantId)}
                    aria-expanded={isOpen}
                    className="flex-1 min-w-0 flex flex-col items-start gap-0.5 text-left min-h-[44px] justify-center"
                  >
                    <span className="font-bold text-foreground truncate w-full">{p.participantName}</span>
                    <span className="text-xs text-muted-foreground">
                      <MoneyText value={p.total} emphasis="muted" /> · {p.count}건{p.latestDate ? ` · 최근 ${p.latestDate}` : ''}
                    </span>
                  </button>
                  <LinkButton
                    href={`/supporter/${p.participantId}/transactions`}
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                  >
                    보기
                  </LinkButton>
                </div>

                {isOpen && (
                  <ul className="border-t border-border">
                    {recent.map((r) => (
                      <li key={r.id} className="border-t border-border first:border-t-0">
                        <Link
                          href={`/supporter/transactions/${r.id}`}
                          className="flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] hover:bg-muted-hover transition-colors"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm truncate">{r.description || '(내용 없음)'}</span>
                            <span className="text-xs text-muted-foreground">{r.usageDate}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-sm font-bold">
                              <MoneyText value={r.amount ?? 0} />
                            </span>
                            <StatusPill
                              label={settlementLabel(r.settlementStatus)}
                              intent={settlementIntent(r.settlementStatus)}
                            />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
