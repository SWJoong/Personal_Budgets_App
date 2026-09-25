'use client'

import { useId, useState, useTransition } from 'react'
import { saveEvaluation, type EvaluationContext } from '@/app/actions/evaluation'
import { ACHIEVEMENT_LEVELS, periodLabel, shiftPeriod, type Achievement } from '@/utils/evaluation'
import { formatDate } from '@/utils/formatDate'
import { Button } from '@/components/ui/Button'
import { MoneyText } from '@/components/ui/MoneyText'
import { useToast } from '@/components/ui/LiveRegion'

/**
 * 월별 평가 양식 — 한 당사자·한 달. 설계: 20_evaluations.sql (사용자 결정 2026-09-25).
 *   ① 월별 예산 사용 평가: 그 달 지출 요약(원장 계산, 읽기) + 서술
 *   ② 계획 이행 정도: 기준 이용계획의 항목(신청 서비스)별 4단계 + 메모
 *   ③ 당사자 직접 평가: 당사자가 한 말을 실무자가 그대로 기록(대필)
 *   ④ 종합 소견
 * 초기값은 context 로 한 번만 채운다 — 부모가 달/당사자가 바뀔 때 key 로 다시 마운트한다.
 */

type ItemState = Record<string, { achievement?: Achievement; note: string }>

export default function EvaluationForm({
  context,
  onChangePeriod,
  onSaved,
}: {
  context: EvaluationContext
  onChangePeriod: (period: string) => void
  onSaved: () => void
}) {
  const uid = useId()
  const { announce } = useToast()
  const [budgetUsageNote, setBudgetUsageNote] = useState(context.evaluation?.budgetUsageNote ?? '')
  const [participantOpinion, setParticipantOpinion] = useState(context.evaluation?.participantOpinion ?? '')
  const [overallNote, setOverallNote] = useState(context.evaluation?.overallNote ?? '')
  const [items, setItems] = useState<ItemState>(() =>
    Object.fromEntries(
      context.planItems.map((pi) => {
        const saved = context.itemEvaluations.find((ie) => ie.requestedServiceId === pi.id)
        return [pi.id, { achievement: saved?.achievement, note: saved?.note ?? '' }]
      }),
    ),
  )
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function setItem(id: string, patch: Partial<ItemState[string]>) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], note: prev[id]?.note ?? '', ...patch } }))
  }

  function save() {
    const payloadItems = context.planItems.flatMap((pi) => {
      const it = items[pi.id]
      return it?.achievement ? [{ requestedServiceId: pi.id, achievement: it.achievement, note: it.note }] : []
    })
    setError('')
    startTransition(async () => {
      const result = await saveEvaluation({
        participantId: context.participantId,
        period: context.period,
        budgetUsageNote,
        participantOpinion,
        overallNote,
        items: payloadItems,
      })
      if (result.error) {
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      announce(`${periodLabel(context.period)} 평가를 저장했어요.`)
      onSaved()
    })
  }

  const { usage } = context
  const textareaClass =
    'w-full p-3 rounded-xl bg-card ring-1 ring-border text-sm text-foreground leading-relaxed min-h-[88px]'

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      {/* 달 이동 */}
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="secondary"
          iconOnly
          aria-label="이전 달"
          disabled={pending}
          onClick={() => onChangePeriod(shiftPeriod(context.period, -1))}
        >
          <span aria-hidden="true">◀</span>
        </Button>
        <div className="flex flex-col items-center text-center">
          <p className="font-bold text-foreground">{periodLabel(context.period)} 평가</p>
          <p className="text-xs text-muted-foreground">
            {context.evaluation
              ? `마지막 저장 ${formatDate(context.evaluation.updatedAt)}`
              : '아직 작성하지 않은 달이에요.'}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          iconOnly
          aria-label="다음 달"
          disabled={pending}
          onClick={() => onChangePeriod(shiftPeriod(context.period, 1))}
        >
          <span aria-hidden="true">▶</span>
        </Button>
      </div>

      {context.recentPeriods.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="작성된 달">
          <span className="text-xs text-muted-foreground">작성된 달:</span>
          {context.recentPeriods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChangePeriod(p)}
              disabled={pending || p === context.period}
              aria-current={p === context.period ? 'true' : undefined}
              className="min-h-[44px] px-2.5 rounded-lg text-xs font-bold ring-1 ring-border bg-card text-foreground hover:bg-muted-hover transition-colors aria-[current=true]:bg-muted aria-[current=true]:text-muted-foreground"
            >
              {periodLabel(p)}
            </button>
          ))}
        </div>
      )}

      {/* ① 월별 예산 사용 */}
      <section aria-labelledby={`${uid}-budget`} className="flex flex-col gap-2">
        <h3 id={`${uid}-budget`} className="text-sm font-black text-foreground">① 월별 예산 사용 평가</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-muted text-sm">
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">쓴 돈(환수 제외)</dt>
            <dd className="font-bold"><MoneyText value={usage.spent} emphasis="body" /></dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">지출 건수</dt>
            <dd className="font-bold">{usage.count}건</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">정산 대기</dt>
            <dd>{usage.byStatus.pending.count}건</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">인정 · 반려 · 환수</dt>
            <dd>
              {usage.byStatus.accepted.count} · {usage.byStatus.rejected.count} · {usage.byStatus.recovered.count}건
            </dd>
          </div>
        </dl>
        <label htmlFor={`${uid}-budget-note`} className="text-xs font-bold text-muted-foreground">
          이번 달 예산을 어떻게 썼는지 적어 주세요
        </label>
        <textarea
          id={`${uid}-budget-note`}
          value={budgetUsageNote}
          onChange={(e) => setBudgetUsageNote(e.target.value)}
          placeholder="예) 계획한 미술 재료를 샀고, 남은 돈은 다음 달 수영에 쓰기로 했어요."
          className={textareaClass}
        />
      </section>

      {/* ② 계획 이행 정도 (항목별) */}
      <section aria-labelledby={`${uid}-plan`} className="flex flex-col gap-2">
        <h3 id={`${uid}-plan`} className="text-sm font-black text-foreground">② 계획 이행 정도</h3>
        {context.planPeriod && (
          <p className="text-xs text-muted-foreground">
            기준 이용계획
            {context.planPeriod.start ? ` ${formatDate(context.planPeriod.start)}` : ''}
            {context.planPeriod.end ? ` ~ ${formatDate(context.planPeriod.end)}` : ''}
          </p>
        )}
        {context.planItems.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3 rounded-xl bg-muted leading-relaxed">
            승인된 이용계획 항목이 없어요. 계획이 승인되면 항목별로 평가할 수 있어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {context.planItems.map((pi) => {
              const it = items[pi.id] ?? { note: '' }
              return (
                <li key={pi.id}>
                  <fieldset className="flex flex-col gap-2 p-3 rounded-xl ring-1 ring-border">
                    <legend className="px-1 text-sm font-bold text-foreground">
                      {pi.priority}. {pi.serviceName}
                    </legend>
                    <p className="text-xs text-muted-foreground">
                      이번 달 쓴 돈 <MoneyText value={pi.monthSpent} emphasis="muted" />
                      {pi.estimatedCost != null && (
                        <>
                          {' '}· 계획 전체 예상 <MoneyText value={pi.estimatedCost} emphasis="muted" />
                        </>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ACHIEVEMENT_LEVELS.map((l) => {
                        const checked = it.achievement === l.value
                        return (
                          <label
                            key={l.value}
                            className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg ring-1 text-sm font-bold cursor-pointer transition-colors ${
                              checked
                                ? 'bg-primary text-primary-foreground ring-primary hover:bg-primary-hover'
                                : 'bg-card text-foreground ring-border hover:bg-muted-hover'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`${uid}-ach-${pi.id}`}
                              value={l.value}
                              checked={checked}
                              onChange={() => setItem(pi.id, { achievement: l.value })}
                              className="size-4 accent-current"
                            />
                            {l.label}
                          </label>
                        )
                      })}
                    </div>
                    <input
                      type="text"
                      value={it.note}
                      onChange={(e) => setItem(pi.id, { note: e.target.value })}
                      aria-label={`${pi.serviceName} 이행 메모`}
                      placeholder="메모 (선택) — 예) 매주 참여했어요"
                      className="p-2 rounded-lg bg-card ring-1 ring-border text-sm text-foreground min-h-[44px]"
                    />
                  </fieldset>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ③ 당사자 직접 평가 (실무자 대필) */}
      <section aria-labelledby={`${uid}-voice`} className="flex flex-col gap-2">
        <h3 id={`${uid}-voice`} className="text-sm font-black text-foreground">③ 당사자가 직접 한 평가</h3>
        <label htmlFor={`${uid}-voice-note`} className="text-xs font-bold text-muted-foreground">
          당사자가 한 말을 고치지 말고 그대로 적어 주세요 (실무자가 대신 기록)
        </label>
        <textarea
          id={`${uid}-voice-note`}
          value={participantOpinion}
          onChange={(e) => setParticipantOpinion(e.target.value)}
          placeholder="예) 그림 그리는 게 제일 재미있었어요. 다음엔 친구랑 같이 가고 싶어요."
          className={textareaClass}
        />
      </section>

      {/* ④ 종합 소견 */}
      <section aria-labelledby={`${uid}-overall`} className="flex flex-col gap-2">
        <h3 id={`${uid}-overall`} className="text-sm font-black text-foreground">④ 종합 소견</h3>
        <label htmlFor={`${uid}-overall-note`} className="sr-only">
          종합 소견
        </label>
        <textarea
          id={`${uid}-overall-note`}
          value={overallNote}
          onChange={(e) => setOverallNote(e.target.value)}
          placeholder="실무자 소견과 다음 달 계획을 적어 주세요."
          className={textareaClass}
        />
      </section>

      {error && (
        <p role="alert" className="text-sm font-bold text-danger-fg">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          {context.evaluation ? '평가 고쳐서 저장' : '평가 저장'}
        </Button>
      </div>
    </form>
  )
}
