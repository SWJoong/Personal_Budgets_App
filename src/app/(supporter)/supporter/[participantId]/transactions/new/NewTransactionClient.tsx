'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordServiceUsage } from '@/app/actions/serviceUsage'

interface Allocation {
  id: string
  allocated_amount: number
  total_ceiling: number
  starts_on: string
  ends_on: string
}

const inputClass =
  'p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 leading-relaxed focus:ring-zinc-400 focus:outline-none'

function won(n: number): string {
  return Number(n).toLocaleString('ko-KR') + '원'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NewTransactionClient({
  participantId,
  allocations,
}: {
  participantId: string
  allocations: Allocation[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [allocationId, setAllocationId] = useState(allocations.length === 1 ? allocations[0].id : '')
  const [amount, setAmount] = useState('')
  const [usageDate, setUsageDate] = useState(today())
  const [description, setDescription] = useState('')
  const [receipt, setReceipt] = useState<{ base64: string; mime: string; name: string } | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setReceipt(null)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('영수증 사진은 5MB 이하로 올려 주세요.')
      e.target.value = ''
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const base64 = result.split(',')[1] ?? ''
      setReceipt({ base64, mime: file.type || 'image/jpeg', name: file.name })
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit() {
    if (!allocationId) {
      setError('예산을 골라 주세요.')
      return
    }
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setError('쓴 금액을 올바르게 적어 주세요.')
      return
    }
    if (!usageDate) {
      setError('쓴 날짜를 골라 주세요.')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await recordServiceUsage({
        participantId,
        allocationId,
        usageDate,
        amount: amt,
        description: description.trim() || undefined,
        receiptBase64: receipt?.base64,
        receiptMimeType: receipt?.mime,
      })
      if ('success' in result && result.success) {
        router.push(`/supporter/${participantId}/transactions`)
        return
      }
      setError(result.error ?? '지출 기록에 실패했어요. 잠시 후 다시 시도해 주세요.')
    })
  }

  if (allocations.length === 0) {
    return (
      <p className="text-zinc-400 text-sm py-8 text-center leading-relaxed">
        아직 배정된 예산이 없어요.
        <br />
        이용계획이 승인되고 예산이 배정된 뒤에 지출을 기록할 수 있어요.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">{error}</div>
      )}

      {allocations.length > 1 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-allocation" className="text-xs text-zinc-500 font-medium">
            어떤 예산인가요? *
          </label>
          <select
            id="tx-allocation"
            value={allocationId}
            onChange={(e) => setAllocationId(e.target.value)}
            className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
          >
            <option value="">골라 주세요</option>
            {allocations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.starts_on} ~ {a.ends_on} · {won(a.allocated_amount)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="tx-amount" className="text-xs text-zinc-500 font-medium">
          얼마를 썼나요? *
        </label>
        <input
          id="tx-amount"
          type="number"
          inputMode="numeric"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="예: 30000"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tx-date" className="text-xs text-zinc-500 font-medium">
          언제 썼나요? *
        </label>
        <input
          id="tx-date"
          type="date"
          value={usageDate}
          onChange={(e) => setUsageDate(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tx-desc" className="text-xs text-zinc-500 font-medium">
          무엇에 썼나요?
        </label>
        <input
          id="tx-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 수영 강습비"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tx-receipt" className="text-xs text-zinc-500 font-medium">
          영수증 사진 (안 올려도 돼요)
        </label>
        <input
          id="tx-receipt"
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-bold file:text-zinc-700"
        />
        {receipt && <span className="text-xs text-zinc-500">📎 {receipt.name}</span>}
      </div>

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
      >
        {pending ? '기록하고 있어요...' : '지출 기록하기'}
      </button>
    </div>
  )
}
