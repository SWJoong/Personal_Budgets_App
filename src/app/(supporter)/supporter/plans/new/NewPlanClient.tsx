'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createUtilizationPlan } from '@/app/actions/utilizationPlan'
import { FormField } from '@/components/ui/FormField'

interface Candidate {
  applicationId: string
  participantId: string
  participantName: string
}

export default function NewPlanClient({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [applicationId, setApplicationId] = useState('')

  function handleCreate() {
    const candidate = candidates.find((c) => c.applicationId === applicationId)
    if (!candidate) {
      setError('당사자를 선택해주세요.')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await createUtilizationPlan({
        participantId: candidate.participantId,
        applicationId: candidate.applicationId,
        // 담당자가 작성하되 당사자와 함께 만든다는 뜻(주도성 지표 기본값).
        authoredWithSupport: 'with_support',
      })
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.planId) router.push(`/supporter/plans/${result.planId}`)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">{error}</div>
      )}

      {candidates.length === 0 ? (
        <p className="text-zinc-400 text-sm py-8 text-center leading-relaxed">
          계획을 만들 수 있는 당사자가 없어요.<br />
          선정된 신청자에게만 계획을 만들 수 있고, 이미 계획이 있는 경우는 제외됩니다.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <FormField id="new-plan-application" label="당사자" required>
            {(field) => (
              <select
                {...field}
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
              >
                <option value="">선택해주세요</option>
                {candidates.map((c) => (
                  <option key={c.applicationId} value={c.applicationId}>{c.participantName}</option>
                ))}
              </select>
            )}
          </FormField>

          <button
            onClick={handleCreate}
            disabled={pending || !applicationId}
            className="p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
          >
            {pending ? '만들고 있어요...' : '계획 만들기'}
          </button>
        </div>
      )}
    </div>
  )
}
