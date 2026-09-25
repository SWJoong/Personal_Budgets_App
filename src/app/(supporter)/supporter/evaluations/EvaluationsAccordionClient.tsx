'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { getEvaluationContext, type EvaluationContext } from '@/app/actions/evaluation'
import { periodLabel } from '@/utils/evaluation'
import EvaluationForm from './EvaluationForm'

export interface EvaluationParticipantRow {
  id: string
  name: string
  /** 가장 최근에 작성된 평가 달('YYYY-MM') — 없으면 null. */
  latestPeriod: string | null
}

interface LoadedContext {
  key: string
  context?: EvaluationContext
  error?: string
}

/**
 * 계획·평가 — 당사자별 펼쳐보기(아코디언). 사용자 요청 2026-09-25("각 당사자별로 펼쳐서 보는 방법").
 * 한 번에 한 명만 펼친다. 펼칠 때(또는 달을 바꿀 때) 그 당사자·달의 평가 맥락을 서버 액션으로 불러와
 * 월별 평가 양식을 바로 보여준다 — 목록 페이지는 전 당사자 데이터를 미리 싣지 않아 가볍다.
 * 불러오기는 이벤트 핸들러에서만 한다(effect 없음).
 */
export default function EvaluationsAccordionClient({
  participants,
  defaultPeriod,
}: {
  participants: EvaluationParticipantRow[]
  defaultPeriod: string
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [periods, setPeriods] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState<Record<string, LoadedContext>>({})
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  // 당사자별 '가장 최근에 요청한' 키 — 최신 요청의 응답만 반영하는 방어 코드. 지금 UI 에선 저장 뒤 새로고침이
  // 끝날 때까지 양식 버튼이 비활성(React 19 전이 얽힘)이라 서로 다른 달 요청이 겹치기 어렵지만, 그 동작에
  // 기대지 않고 늦게 온 옛 응답이 새 달을 덮어 '불러오는 중'에 멈추는 일을 원천 차단한다.
  const latestRequested = useRef<Record<string, string>>({})

  function load(participantId: string, period: string) {
    const key = `${participantId}:${period}`
    latestRequested.current[participantId] = key
    setLoadingKey(key)
    startTransition(async () => {
      const result = await getEvaluationContext(participantId, period)
      if (latestRequested.current[participantId] !== key) return // 옛 응답 — 버린다
      setLoaded((prev) => ({ ...prev, [participantId]: { key, context: result.context, error: result.error } }))
      setLoadingKey((current) => (current === key ? null : current))
    })
  }

  function periodOf(participantId: string) {
    return periods[participantId] ?? defaultPeriod
  }

  function toggle(participantId: string) {
    if (expanded === participantId) {
      setExpanded(null)
      return
    }
    setExpanded(participantId)
    const period = periodOf(participantId)
    if (loaded[participantId]?.key !== `${participantId}:${period}`) load(participantId, period)
  }

  function changePeriod(participantId: string, period: string) {
    setPeriods((prev) => ({ ...prev, [participantId]: period }))
    load(participantId, period)
  }

  return (
    <ul className="flex flex-col gap-2">
      {participants.map((p) => {
        const isOpen = expanded === p.id
        const panelId = `evaluation-panel-${p.id}`
        const period = periodOf(p.id)
        const current = loaded[p.id]
        // 이 달 데이터가 아직 없을 때만 '불러오는 중' — 저장 뒤 같은 달을 다시 불러오는 동안엔 양식을 유지(깜빡임 방지).
        const hasData = current?.key === `${p.id}:${period}`
        const refreshing = hasData && loadingKey === `${p.id}:${period}`
        return (
          <li key={p.id} className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
            <h2 className="m-0">
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full flex items-center justify-between gap-3 p-4 min-h-[44px] text-left hover:bg-muted-hover transition-colors"
              >
                <span className="font-bold text-foreground truncate">{p.name}</span>
                <span className="flex items-center gap-2 shrink-0 text-xs font-bold text-muted-foreground">
                  {p.latestPeriod ? `최근 평가 ${periodLabel(p.latestPeriod)}` : '평가 없음'}
                  <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                </span>
              </button>
            </h2>

            {isOpen && (
              <div id={panelId} className="border-t border-border p-4 flex flex-col gap-4" aria-busy={refreshing || undefined}>
                {!hasData ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    {periodLabel(period)} 평가를 불러오는 중이에요…
                  </p>
                ) : current.error ? (
                  <p role="alert" className="text-sm font-bold text-danger-fg">
                    {current.error}
                  </p>
                ) : current.context ? (
                  <EvaluationForm
                    key={current.key}
                    context={current.context}
                    onChangePeriod={(next) => changePeriod(p.id, next)}
                    onSaved={() => load(p.id, period)}
                  />
                ) : null}
                <Link
                  href={`/supporter/evaluations/${p.id}`}
                  className="self-start inline-flex items-center min-h-[44px] text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  모니터링·정산 기록 모두 보기 →
                </Link>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
