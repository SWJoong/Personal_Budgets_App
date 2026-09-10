'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateServiceUsage, deleteServiceUsage } from '@/app/actions/serviceUsage'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/**
 * 거래 상세의 수정/삭제 어포던스 (GOAL축 A, A2). 계약: TransactionEditClient.test.tsx.
 * 서버컴포넌트(page.tsx)가 이미 settlement_status 를 읽으므로 canEdit=(pending) 과 초기값을
 * prop 으로 넘겨 이 클라이언트가 프리필 폼 + 삭제를 담당한다.
 *
 * 정책: pending 일 때만 컨트롤을 노출한다(검토 끝나면 안내만). UI 는 1차 차단이고,
 * 서버 액션(updateServiceUsage·deleteServiceUsage)이 2차로 상태를 강제 재검증한다.
 *
 * participantId 는 A2 계약 표면(서버가 전달)이라 받아 두되, 삭제 후 이동은 조직 원장
 * (/supporter/transactions)으로 통일한다.
 */
interface TransactionEditClientProps {
  usageId: string
  participantId: string
  canEdit: boolean
  initial: { amount: number; usageDate: string; description: string }
}

const inputClass = 'p-2 rounded-lg bg-card ring-1 ring-border text-sm'

export default function TransactionEditClient({
  usageId,
  canEdit,
  initial,
}: TransactionEditClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [amount, setAmount] = useState(String(initial.amount))
  const [usageDate, setUsageDate] = useState(initial.usageDate)
  const [description, setDescription] = useState(initial.description)

  // 검토가 끝난 지출은 수정·삭제 불가 — 안내만 보여준다(액션도 재차 거부).
  if (!canEdit) {
    return (
      <Card variant="muted">
        <p className="text-sm text-muted-foreground leading-relaxed">
          정산 검토가 끝나 수정할 수 없어요.
        </p>
      </Card>
    )
  }

  function handleSave() {
    setError('')
    startTransition(async () => {
      const result = await updateServiceUsage(usageId, {
        amount: Number(amount),
        usageDate,
        description,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    if (!window.confirm('이 지출을 삭제할까요?')) return
    setError('')
    startTransition(async () => {
      const result = await deleteServiceUsage(usageId)
      if (result?.error) {
        setError(result.error)
        return
      }
      router.push('/supporter/transactions')
    })
  }

  return (
    <Card variant="default" className="flex flex-col gap-3">
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-danger-bg text-danger-fg text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="edit-amount" className="text-xs text-muted-foreground font-medium">
          얼마를 썼나요?
        </label>
        <input
          id="edit-amount"
          type="number"
          inputMode="numeric"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="edit-date" className="text-xs text-muted-foreground font-medium">
          언제 썼나요?
        </label>
        <input
          id="edit-date"
          type="date"
          value={usageDate}
          onChange={(e) => setUsageDate(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="edit-desc" className="text-xs text-muted-foreground font-medium">
          무엇에 썼나요?
        </label>
        <input
          id="edit-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 수영 강습비"
          className={inputClass}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={pending}>
          저장
        </Button>
        <Button variant="danger" onClick={handleDelete} disabled={pending}>
          삭제
        </Button>
      </div>
    </Card>
  )
}
