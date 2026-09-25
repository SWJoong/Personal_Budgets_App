'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateServiceUsage, deleteServiceUsage } from '@/app/actions/serviceUsage'
import { settlementLabel, settlementIntent } from '@/utils/settlementStatus'
import { formatDate } from '@/utils/formatDate'
import { MoneyText } from '@/components/ui/MoneyText'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/LiveRegion'

export interface LedgerTxRow {
  id: string
  usageDate: string
  description: string | null
  amount: number
  settlementStatus: string
}

/**
 * 당사자 거래장부 — 행열(표) + 인라인 편집. 카드 스택 대신 표로 보여 확인이 쉽고, pending 지출은
 * 상세 페이지로 이동하지 않고 표 안에서 바로 금액·날짜·내용을 고치거나 삭제한다(사용자 요청 2026-09-25).
 *
 * 정책: 수정/삭제는 정산 대기(pending)만 — updateServiceUsage/deleteServiceUsage 가 서버에서 재검증한다.
 * 검토가 끝난 지출은 '상세'로만 열람. view-as 중에는 액션이 차단(읽기전용 미리보기).
 */
export default function TransactionsLedgerClient({ rows }: { rows: LedgerTxRow[] }) {
  const router = useRouter()
  const { announce } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="text-sm text-danger-fg font-bold">{error}</p>}
      <div className="overflow-x-auto rounded-2xl ring-1 ring-border bg-card">
        <table className="w-full min-w-[34rem] text-sm border-collapse">
          <caption className="sr-only">거래장부 표 — 날짜, 내용, 금액, 정산 상태, 작업</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="text-left font-medium px-3 py-2 whitespace-nowrap">날짜</th>
              <th scope="col" className="text-left font-medium px-3 py-2">내용</th>
              <th scope="col" className="text-right font-medium px-3 py-2 whitespace-nowrap">금액</th>
              <th scope="col" className="text-left font-medium px-3 py-2 whitespace-nowrap">정산 상태</th>
              <th scope="col" className="text-right font-medium px-3 py-2 whitespace-nowrap">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              editingId === row.id ? (
                <EditRow
                  key={row.id}
                  row={row}
                  onDone={() => setEditingId(null)}
                  onError={setError}
                  announce={announce}
                  refresh={() => router.refresh()}
                />
              ) : (
                <tr key={row.id} className="border-b border-border last:border-b-0 align-middle">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(row.usageDate)}</td>
                  <td className="px-3 py-2">
                    <span className="text-foreground">{row.description || '(내용 없음)'}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-bold">
                    <MoneyText value={row.amount} emphasis="body" />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <StatusPill label={settlementLabel(row.settlementStatus)} intent={settlementIntent(row.settlementStatus)} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.settlementStatus === 'pending' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setError(''); setEditingId(row.id) }}
                        >
                          수정
                        </Button>
                      )}
                      <Link
                        href={`/supporter/transactions/${row.id}`}
                        className="inline-flex items-center min-h-[44px] px-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        상세
                      </Link>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EditRow({
  row,
  onDone,
  onError,
  announce,
  refresh,
}: {
  row: LedgerTxRow
  onDone: () => void
  onError: (msg: string) => void
  announce: (msg: string, politeness?: 'polite' | 'assertive') => void
  refresh: () => void
}) {
  const [amount, setAmount] = useState(String(row.amount))
  const [usageDate, setUsageDate] = useState(row.usageDate)
  const [description, setDescription] = useState(row.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      onError('금액을 올바르게 입력해 주세요.')
      return
    }
    onError('')
    startTransition(async () => {
      const result = await updateServiceUsage(row.id, { amount: amountNum, usageDate, description })
      if (result.error) {
        onError(result.error)
        announce(result.error, 'assertive')
        return
      }
      announce('지출을 수정했어요.')
      onDone()
      refresh()
    })
  }

  function remove() {
    onError('')
    startTransition(async () => {
      const result = await deleteServiceUsage(row.id)
      if (result.error) {
        onError(result.error)
        announce(result.error, 'assertive')
        return
      }
      announce('지출을 삭제했어요.')
      onDone()
      refresh()
    })
  }

  return (
    <tr className="border-b border-border last:border-b-0 bg-muted/40">
      <td colSpan={5} className="px-3 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              날짜
              <input
                type="date"
                value={usageDate}
                onChange={(e) => setUsageDate(e.target.value)}
                className="p-2 rounded-lg bg-card ring-1 ring-border text-sm text-foreground min-h-[44px]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              금액
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="금액"
                className="p-2 rounded-lg bg-card ring-1 ring-border text-sm text-foreground min-h-[44px] w-32"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground flex-1 min-w-[10rem]">
              내용
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-label="내용"
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
            {/* 2단계 삭제 확인 — 지출(돈 기록) 삭제라 실수 방지(모니터링 삭제 #180 과 동일 패턴). */}
            {confirmDelete ? (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-danger-fg font-bold">정말 삭제할까요?</span>
                <Button size="sm" variant="danger" onClick={remove} disabled={pending}>
                  {pending ? '삭제 중...' : '삭제'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)} disabled={pending}>
                  아니요
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)} disabled={pending} className="ml-auto">
                삭제
              </Button>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
