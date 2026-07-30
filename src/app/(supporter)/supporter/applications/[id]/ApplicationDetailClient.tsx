'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordConsent, updateApplicationStatus, type ApplicationStatus } from '@/app/actions/application'
import { decideSelection } from '@/app/actions/selection'

interface ConsentRecord {
  id: string
  consent_type: 'general' | 'unique_id'
  is_agreed: boolean
  withdrawn_at: string | null
}

interface SelectionDecision {
  is_selected: boolean
  selection_reason: string | null
}

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: '작성 중',
  received: '접수됨',
  screening: '심사 중',
  selected: '선정됨',
  not_selected: '선정 안 됨',
  withdrawn: '철회됨',
}

const CONSENT_LABEL: Record<'general' | 'unique_id', string> = {
  general: '개인정보 수집·이용 동의',
  unique_id: '고유식별정보(주민등록번호 등) 처리 동의',
}

export default function ApplicationDetailClient({
  applicationId,
  participantId,
  participantName,
  cohortName,
  status,
  isAdmin,
  initialConsents,
  initialDecision,
}: {
  applicationId: string
  participantId: string
  participantName: string
  cohortName: string
  status: string
  isAdmin: boolean
  initialConsents: ConsentRecord[]
  initialDecision: SelectionDecision | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [agreed, setAgreed] = useState<Record<'general' | 'unique_id', boolean>>({
    general: initialConsents.find((c) => c.consent_type === 'general' && !c.withdrawn_at)?.is_agreed ?? false,
    unique_id: initialConsents.find((c) => c.consent_type === 'unique_id' && !c.withdrawn_at)?.is_agreed ?? false,
  })

  const [reason, setReason] = useState('')

  function handleSaveConsents() {
    setError('')
    startTransition(async () => {
      for (const consentType of ['general', 'unique_id'] as const) {
        const result = await recordConsent({
          applicationId,
          participantId,
          consentType,
          isAgreed: agreed[consentType],
        })
        if (result.error) {
          setError(result.error)
          return
        }
      }
      router.refresh()
    })
  }

  function handleDecide(isSelected: boolean) {
    if (!isSelected && !reason.trim()) {
      setError('선정하지 않는 경우 사유를 입력해주세요.')
      return
    }
    if (!isSelected && !window.confirm('정말 선정하지 않음으로 결정할까요? 결정 뒤에는 스스로 바꿀 수 없어요.')) {
      return
    }
    setError('')
    startTransition(async () => {
      const result = await decideSelection({ applicationId, isSelected, selectionReason: reason.trim() || undefined })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleWithdraw() {
    if (!window.confirm('정말 이 신청을 철회 처리할까요?')) return
    setError('')
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, 'withdrawn')
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium leading-relaxed">
          {error}
        </div>
      )}

      <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-1">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">신청 정보</span>
        <span className="text-lg font-bold">{participantName}</span>
        <span className="text-sm text-zinc-500">{cohortName}</span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 w-fit mt-2">
          {STATUS_LABEL[status as ApplicationStatus] ?? status}
        </span>
      </section>

      <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-4">
        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">동의 확인</span>
        {(['general', 'unique_id'] as const).map((type) => (
          <label key={type} className="flex items-center gap-3 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={agreed[type]}
              onChange={(e) => setAgreed((prev) => ({ ...prev, [type]: e.target.checked }))}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium text-zinc-700">{CONSENT_LABEL[type]}</span>
          </label>
        ))}
        <button
          onClick={handleSaveConsents}
          disabled={pending}
          className="p-3 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          동의 내용 저장
        </button>
      </section>

      {isAdmin && (
        <section className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-4">
          <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">선정 결정</span>
          {initialDecision ? (
            <div className="flex flex-col gap-1">
              <span className={`font-bold ${initialDecision.is_selected ? 'text-emerald-600' : 'text-red-600'}`}>
                {initialDecision.is_selected ? '선정됨' : '선정 안 됨'}
              </span>
              {initialDecision.selection_reason && (
                <p className="text-sm text-zinc-500 leading-relaxed">{initialDecision.selection_reason}</p>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="사유 (선정하지 않을 때는 필수예요)"
                rows={3}
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecide(true)}
                  disabled={pending}
                  className="flex-1 p-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  선정
                </button>
                <button
                  onClick={() => handleDecide(false)}
                  disabled={pending}
                  className="flex-1 p-3 rounded-xl bg-zinc-200 text-zinc-700 font-bold text-sm hover:bg-zinc-300 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  선정 안 함
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {status !== 'withdrawn' && status !== 'selected' && status !== 'not_selected' && (
        <button
          onClick={handleWithdraw}
          disabled={pending}
          className="p-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          신청 철회 처리
        </button>
      )}
    </div>
  )
}
