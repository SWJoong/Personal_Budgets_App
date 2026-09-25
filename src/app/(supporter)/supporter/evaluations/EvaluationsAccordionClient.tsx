'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { getEvaluationContext, type EvaluationContext } from '@/app/actions/evaluation'
import { periodLabel, shiftPeriod } from '@/utils/evaluation'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/LiveRegion'
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

const DISCARD_MESSAGE = '저장하지 않은 내용이 있어요. 이동하면 적은 내용이 사라져요. 계속할까요?'
/** aria-disabled 잠금의 시각 표시(native disabled 대신 — 포커스 보존). */
const NAV_LOCKED_CLASS =
  'aria-disabled:cursor-not-allowed aria-disabled:bg-disabled-bg aria-disabled:text-disabled-fg aria-disabled:hover:bg-disabled-bg'

/**
 * 계획·평가 — 당사자별 펼쳐보기(아코디언). 사용자 요청 2026-09-25("각 당사자별로 펼쳐서 보는 방법").
 * 한 번에 한 명만 펼친다. 펼칠 때(또는 달을 바꿀 때) 그 당사자·달의 평가 맥락을 서버 액션으로 불러와
 * 월별 평가 양식을 바로 보여준다 — 목록 페이지는 전 당사자 데이터를 미리 싣지 않아 가볍다.
 *  - 달 이동(◀▶·작성된 달)은 패널 위쪽에 고정 — 불러오는 동안에도 남아 있어 키보드 포커스를 잃지 않는다.
 *  - 불러오기 실패는 캐시하지 않는다(다시 펼치거나 '다시 불러오기'로 재시도).
 *  - 저장 중에는 헤더·달 이동을 잠근다. 저장 뒤 서버값(updatedAt)이 오면 양식을 다시 마운트한다.
 *  - 저장하지 않은 입력이 있으면 달 이동·접기·다른 당사자 선택 전에 확인한다.
 * 불러오기는 이벤트 핸들러에서만 한다(effect 없음).
 */
export default function EvaluationsAccordionClient({
  participants,
  defaultPeriod,
}: {
  participants: EvaluationParticipantRow[]
  /** 오늘이 속한 한국 달 — 기본 달이자 '다음 달' 이동의 상한(미래 달 평가 방지). */
  defaultPeriod: string
}) {
  const { announce } = useToast()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [periods, setPeriods] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState<Record<string, LoadedContext>>({})
  const [recent, setRecent] = useState<Record<string, string[]>>({})
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  // 저장 직후 다시 마운트되는 양식이 '마지막 저장' 줄로 포커스를 옮기도록(저장 버튼은 저장 중 잠겨 포커스를 잃는다).
  const [focusAfterSaveId, setFocusAfterSaveId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  // 당사자별 '가장 최근에 요청한' 키 — 늦게 온 옛 응답이 새 달을 덮지 않게 최신 요청의 응답만 반영한다.
  const latestRequested = useRef<Record<string, string>>({})
  // 저장하지 않은 입력이 있는 당사자 id(한 번에 하나만 펼쳐지므로 하나면 충분). 렌더에 쓰지 않아 ref.
  const dirtyId = useRef<string | null>(null)

  function load(participantId: string, period: string, announceWhenDone = false) {
    const key = `${participantId}:${period}`
    latestRequested.current[participantId] = key
    setLoadingKey(key)
    startTransition(async () => {
      const result = await getEvaluationContext(participantId, period)
      if (latestRequested.current[participantId] !== key) return // 옛 응답 — 버린다
      setLoaded((prev) => ({ ...prev, [participantId]: { key, context: result.context, error: result.error } }))
      if (result.context) setRecent((prev) => ({ ...prev, [participantId]: result.context!.recentPeriods }))
      setLoadingKey((current) => (current === key ? null : current))
      if (result.error) announce(result.error, 'assertive')
      else if (announceWhenDone) announce(`${periodLabel(period)} 평가를 불러왔어요.`)
    })
  }

  function periodOf(participantId: string) {
    return periods[participantId] ?? defaultPeriod
  }

  /** 저장 안 한 입력이 있으면 확인. 계속해도 되면 true. */
  function confirmDiscard(): boolean {
    if (dirtyId.current && !window.confirm(DISCARD_MESSAGE)) return false
    dirtyId.current = null
    return true
  }

  function toggle(participantId: string) {
    if (savingId) return
    if (!confirmDiscard()) return
    setFocusAfterSaveId(null)
    if (expanded === participantId) {
      setExpanded(null)
      return
    }
    setExpanded(participantId)
    const period = periodOf(participantId)
    const cur = loaded[participantId]
    // 오류는 캐시하지 않는다 — 다시 펼치면 재요청.
    if (cur?.key !== `${participantId}:${period}` || cur.error) load(participantId, period)
  }

  function changePeriod(participantId: string, period: string) {
    const currentPeriod = periodOf(participantId)
    // 잠김(저장 중·불러오는 중)·같은 달·미래 달이면 무시 — 버튼은 aria-disabled 라 포커스는 유지된다.
    if (savingId || loadingKey === `${participantId}:${currentPeriod}`) return
    if (period === currentPeriod || period > defaultPeriod) return
    if (!confirmDiscard()) return
    setFocusAfterSaveId(null)
    setPeriods((prev) => ({ ...prev, [participantId]: period }))
    load(participantId, period, true)
  }

  return (
    <ul className="flex flex-col gap-2">
      {participants.map((p) => {
        const isOpen = expanded === p.id
        const panelId = `evaluation-panel-${p.id}`
        const period = periodOf(p.id)
        const key = `${p.id}:${period}`
        const current = loaded[p.id]
        // 이 달 데이터가 아직 없을 때만 '불러오는 중' — 저장 뒤 같은 달을 다시 불러오는 동안엔 양식을 유지.
        const hasData = current?.key === key
        const busy = loadingKey === key
        const navLocked = savingId !== null || busy
        const recentPeriods = recent[p.id] ?? []
        return (
          <li key={p.id} className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
            <h2 className="m-0">
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                disabled={savingId !== null}
                className="w-full flex items-center justify-between gap-3 p-4 min-h-[44px] text-left hover:bg-muted-hover transition-colors disabled:cursor-not-allowed"
              >
                <span className="font-bold text-foreground truncate">{p.name}</span>
                <span className="flex items-center gap-2 shrink-0 text-xs font-bold text-muted-foreground">
                  {p.latestPeriod ? `최근 평가 ${periodLabel(p.latestPeriod)}` : '평가 없음'}
                  <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                </span>
              </button>
            </h2>

            {isOpen && (
              <div id={panelId} className="border-t border-border p-4 flex flex-col gap-4" aria-busy={busy || undefined}>
                {/* 달 이동 — 패널에 고정(불러오는 동안에도 유지). 잠금은 native disabled 가 아니라 aria-disabled +
                    클릭 무시: 포커스된 버튼이 disabled 가 되면 브라우저가 포커스를 body 로 보내기 때문(focus fixup). */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      iconOnly
                      aria-label="이전 달"
                      aria-disabled={navLocked || undefined}
                      onClick={() => changePeriod(p.id, shiftPeriod(period, -1))}
                      className={NAV_LOCKED_CLASS}
                    >
                      <span aria-hidden="true">◀</span>
                    </Button>
                    <p className="font-bold text-foreground">{periodLabel(period)} 평가</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      iconOnly
                      aria-label={period >= defaultPeriod ? '다음 달 (이번 달이 마지막이에요)' : '다음 달'}
                      aria-disabled={navLocked || period >= defaultPeriod || undefined}
                      onClick={() => changePeriod(p.id, shiftPeriod(period, 1))}
                      className={NAV_LOCKED_CLASS}
                    >
                      <span aria-hidden="true">▶</span>
                    </Button>
                  </div>
                  {recentPeriods.length > 0 && (
                    <div role="group" aria-label="작성된 달" className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground" aria-hidden="true">작성된 달:</span>
                      {recentPeriods.map((rp) => (
                        <button
                          key={rp}
                          type="button"
                          onClick={() => changePeriod(p.id, rp)}
                          aria-disabled={navLocked || undefined}
                          aria-current={rp === period ? 'true' : undefined}
                          className={`min-h-[44px] px-2.5 rounded-lg text-xs font-bold ring-1 ring-border bg-card text-foreground hover:bg-muted-hover transition-colors aria-[current=true]:bg-muted aria-[current=true]:ring-foreground ${NAV_LOCKED_CLASS}`}
                        >
                          {periodLabel(rp)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {!hasData ? (
                  <p className="text-sm text-muted-foreground">{periodLabel(period)} 평가를 불러오는 중이에요…</p>
                ) : current.error ? (
                  <div className="flex flex-col items-start gap-2">
                    <p role="alert" className="text-sm font-bold text-danger-fg">
                      {current.error}
                    </p>
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => load(p.id, period)}>
                      다시 불러오기
                    </Button>
                  </div>
                ) : current.context ? (
                  <EvaluationForm
                    key={`${current.key}:${current.context.evaluation?.updatedAt ?? 'new'}`}
                    context={current.context}
                    focusStatusOnMount={focusAfterSaveId === p.id}
                    onSavingChange={(saving) => setSavingId(saving ? p.id : null)}
                    onDirtyChange={(dirty) => {
                      dirtyId.current = dirty ? p.id : null
                    }}
                    onSaved={() => {
                      setFocusAfterSaveId(p.id)
                      load(p.id, period)
                    }}
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
