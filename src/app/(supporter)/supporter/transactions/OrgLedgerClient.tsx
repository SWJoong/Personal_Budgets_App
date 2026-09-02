'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buildOrgLedger, type OrgUsageRow } from '@/utils/orgLedger'
import { settlementLabel, settlementStyle } from '@/utils/settlementStatus'

/** org 원장 한 행 — buildOrgLedger 입력(OrgUsageRow) + 펼침 표시용 description. */
export interface LedgerRow extends OrgUsageRow {
  description: string | null
}

const won = (n: number) => n.toLocaleString('ko-KR') + '원'

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
      <section className="p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 flex flex-col gap-2">
        <div>
          <span className="text-xs text-zinc-500">전체 지출</span>
          <p className="text-2xl font-bold">{won(ledger.grandTotal)}</p>
          <p className="text-xs text-zinc-500">{ledger.totalCount}건</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <span key={c.key} className={`text-[11px] font-bold px-2 py-1 rounded-full ${settlementStyle(c.key)}`}>
              {c.label} {ledger.byStatus[c.key].count}
            </span>
          ))}
          {ledger.byStatus.other.count > 0 && (
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-zinc-100 text-zinc-600">
              기타 {ledger.byStatus.other.count}
            </span>
          )}
        </div>
      </section>

      {/* ② 정산상태 필터 */}
      <div role="group" aria-label="정산 상태로 거르기" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value
          return (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              aria-pressed={active}
              className={`px-4 min-h-[44px] rounded-full text-sm font-bold ring-1 transition-colors ${
                active ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white text-zinc-600 ring-zinc-300 hover:ring-zinc-400'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* ③ 당사자별 그룹 */}
      {ledger.participants.length === 0 ? (
        <p className="text-sm text-zinc-600 leading-relaxed py-8 text-center">해당하는 지출이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ledger.participants.map((p) => {
            const isOpen = expanded === p.participantId
            const recent = (byParticipant.get(p.participantId) ?? []).slice(0, 5)
            return (
              <li key={p.participantId} className="rounded-2xl bg-white ring-1 ring-zinc-200 overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-4">
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.participantId)}
                    aria-expanded={isOpen}
                    className="flex-1 min-w-0 flex flex-col items-start gap-0.5 text-left min-h-[44px] justify-center"
                  >
                    <span className="font-bold text-zinc-800 truncate w-full">{p.participantName}</span>
                    <span className="text-xs text-zinc-500">
                      {won(p.total)} · {p.count}건{p.latestDate ? ` · 최근 ${p.latestDate}` : ''}
                    </span>
                  </button>
                  <Link
                    href={`/supporter/${p.participantId}/transactions`}
                    className="shrink-0 px-3 min-h-[44px] rounded-xl bg-zinc-100 text-zinc-700 text-sm font-bold hover:bg-zinc-200 transition-colors flex items-center"
                  >
                    보기
                  </Link>
                </div>

                {isOpen && (
                  <ul className="border-t border-zinc-100">
                    {recent.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-50 first:border-t-0">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm truncate">{r.description || '(내용 없음)'}</span>
                          <span className="text-xs text-zinc-500">{r.usageDate}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-bold">{won(r.amount ?? 0)}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${settlementStyle(r.settlementStatus)}`}>
                            {settlementLabel(r.settlementStatus)}
                          </span>
                        </div>
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
