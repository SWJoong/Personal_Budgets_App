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

type Program = 'seoul' | 'mohw'

interface Domain {
  id: string
  program: string
  code: string
  label: string
  sort_order: number
}

interface Subdomain {
  id: string
  domain_id: string
  code: string
  label: string
  sort_order: number
}

const PROGRAM_LABEL: Record<Program, string> = { seoul: '서울형', mohw: '보건복지부' }

const inputClass =
  'p-3 rounded-xl bg-muted ring-1 ring-border text-foreground leading-relaxed focus:ring-foreground focus:outline-none'

function won(n: number): string {
  return Number(n).toLocaleString('ko-KR') + '원'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NewTransactionClient({
  participantId,
  allocations,
  domains,
  subdomains,
}: {
  participantId: string
  allocations: Allocation[]
  domains: Domain[]
  subdomains: Subdomain[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [allocationId, setAllocationId] = useState(allocations.length === 1 ? allocations[0].id : '')
  const [amount, setAmount] = useState('')
  const [usageDate, setUsageDate] = useState(today())
  const [description, setDescription] = useState('')
  const [program, setProgram] = useState<Program>('seoul')
  const [domainId, setDomainId] = useState('')
  const [subdomainId, setSubdomainId] = useState('')
  const [receipt, setReceipt] = useState<{ base64: string; mime: string; name: string } | null>(null)

  const domainsForProgram = domains.filter((d) => d.program === program)
  const subdomainsForDomain = subdomains.filter((s) => s.domain_id === domainId)
  const hasSubdomains = program === 'mohw' && subdomainsForDomain.length > 0

  function selectProgram(p: Program) {
    setProgram(p)
    setDomainId('')
    setSubdomainId('')
  }
  function selectDomain(id: string) {
    setDomainId(id)
    setSubdomainId('')
  }

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
        domainId: domainId || null,
        subdomainId: program === 'mohw' ? subdomainId || null : null,
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
      <p className="text-muted-foreground text-sm py-8 text-center leading-relaxed">
        아직 배정된 예산이 없어요.
        <br />
        이용계획이 승인되고 예산이 배정된 뒤에 지출을 기록할 수 있어요.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium">{error}</div>
      )}

      {allocations.length > 1 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-allocation" className="text-xs text-muted-foreground font-medium">
            어떤 예산인가요? *
          </label>
          <select
            id="tx-allocation"
            value={allocationId}
            onChange={(e) => setAllocationId(e.target.value)}
            className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium focus:ring-foreground focus:outline-none"
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
        <label htmlFor="tx-amount" className="text-xs text-muted-foreground font-medium">
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
        <label htmlFor="tx-date" className="text-xs text-muted-foreground font-medium">
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
        <label htmlFor="tx-desc" className="text-xs text-muted-foreground font-medium">
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

      {/* 분류축(GOAL축B) — 이 지출이 어느 지원영역에 속하는지. 안 골라도 됨(nullable).
          service_usages.domain_id 그레인만 채운다(예산·정산 domain 은 손대지 않음 — 스펙 §8-5). */}
      <div className="flex flex-col gap-2 rounded-xl bg-muted ring-1 ring-border p-3">
        <span className="text-xs text-muted-foreground font-medium">어느 영역에 썼나요? (안 골라도 돼요)</span>

        <div className="flex gap-2" role="group" aria-label="제도 선택">
          {(['seoul', 'mohw'] as Program[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => selectProgram(p)}
              aria-pressed={program === p}
              className={`flex-1 p-2.5 rounded-lg font-bold text-sm transition-colors min-h-[44px] ${
                program === p
                  ? 'bg-hero text-hero-foreground'
                  : 'bg-card ring-1 ring-border text-muted-foreground hover:ring-foreground'
              }`}
            >
              {PROGRAM_LABEL[p]}
            </button>
          ))}
        </div>

        <select
          id="tx-domain"
          aria-label="지원 영역"
          value={domainId}
          onChange={(e) => selectDomain(e.target.value)}
          className="p-3 rounded-xl bg-card ring-1 ring-border text-foreground font-medium focus:ring-foreground focus:outline-none"
        >
          <option value="">영역 안 고름</option>
          {domainsForProgram.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>

        {hasSubdomains && (
          <select
            id="tx-subdomain"
            aria-label="세부 영역(중분류)"
            value={subdomainId}
            onChange={(e) => setSubdomainId(e.target.value)}
            className="p-3 rounded-xl bg-card ring-1 ring-border text-foreground font-medium focus:ring-foreground focus:outline-none"
          >
            <option value="">세부 영역 안 고름</option>
            {subdomainsForDomain.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tx-receipt" className="text-xs text-muted-foreground font-medium">
          영수증 사진 (안 올려도 돼요)
        </label>
        <input
          id="tx-receipt"
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-bold file:text-muted-foreground"
        />
        {receipt && <span className="text-xs text-muted-foreground">📎 {receipt.name}</span>}
      </div>

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="p-4 rounded-2xl bg-hero text-hero-foreground font-bold text-base hover:opacity-90 transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
      >
        {pending ? '기록하고 있어요...' : '지출 기록하기'}
      </button>
    </div>
  )
}
