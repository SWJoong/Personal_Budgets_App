'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUtilizationPlan } from '@/app/actions/utilizationPlan'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'

/**
 * 이용계획 메타(작성 방식·조력자·계획 기간) 수정 — 계약: PlanMetaEditor.test.tsx.
 * 부분유실 액션 updateUtilizationPlan 배선(생성/제출만 있고 상세 수정이 없던 것).
 * 상태 게이팅 없음(제출·승인 뒤에도 노출) — 권한은 staff + RLS 로만 판정한다.
 */

// 작성 방식(주도성 지표) — 액션 타입 authored_with_support 의 세 값.
// NewPlanClient 는 생성 시 'with_support' 로 고정하므로, 상세에서 세 값을 모두 고르게 한다.
type AuthoredWithSupport = 'self' | 'with_support' | 'by_supporter'
const AUTHORED_OPTIONS: { value: AuthoredWithSupport; label: string }[] = [
  { value: 'self', label: '당사자 혼자 작성' },
  { value: 'with_support', label: '당사자와 함께 작성' },
  { value: 'by_supporter', label: '담당자가 작성' },
]

const controlClass = 'p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium'

export default function PlanMetaEditor({
  planId,
  authoredWithSupport,
  assistedById,
  planPeriodStart,
  planPeriodEnd,
  supporters,
}: {
  planId: string
  authoredWithSupport: string
  assistedById: string | null
  planPeriodStart: string | null
  planPeriodEnd: string | null
  supporters: { id: string; name: string | null }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [authored, setAuthored] = useState(authoredWithSupport)
  const [assisted, setAssisted] = useState(assistedById ?? '')
  const [start, setStart] = useState(planPeriodStart ?? '')
  const [end, setEnd] = useState(planPeriodEnd ?? '')

  function handleSave() {
    setError('')
    startTransition(async () => {
      const result = await updateUtilizationPlan(planId, {
        authoredWithSupport: authored as AuthoredWithSupport,
        // '없음'(빈값)이면 액션이 '' → null 로 비운다(assistedById 는 string|undefined 타입).
        assistedById: assisted,
        planPeriodStart: start, // 빈값이면 액션이 '' → null 처리
        planPeriodEnd: end,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium leading-relaxed"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField id="plan-period-start" label="계획 시작일">
          {(field) => (
            <input
              {...field}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={controlClass}
            />
          )}
        </FormField>
        <FormField id="plan-period-end" label="계획 종료일">
          {(field) => (
            <input
              {...field}
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={controlClass}
            />
          )}
        </FormField>
      </div>

      <FormField id="plan-authored" label="작성 방식">
        {(field) => (
          <select
            {...field}
            value={authored}
            onChange={(e) => setAuthored(e.target.value)}
            className={controlClass}
          >
            {AUTHORED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField id="plan-assisted" label="조력자">
        {(field) => (
          <select
            {...field}
            value={assisted}
            onChange={(e) => setAssisted(e.target.value)}
            className={controlClass}
          >
            <option value="">없음</option>
            {supporters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? '이름 없음'}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <Button variant="primary" onClick={handleSave} loading={pending}>
        저장
      </Button>
    </div>
  )
}
