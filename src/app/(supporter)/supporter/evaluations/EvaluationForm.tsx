'use client'

import { useId, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { saveEvaluation, type EvaluationContext } from '@/app/actions/evaluation'
import { ACHIEVEMENT_LEVELS, periodLabel, formatKSTDateTime, type Achievement } from '@/utils/evaluation'
import { formatDate } from '@/utils/formatDate'
import { Button } from '@/components/ui/Button'
import { MoneyText } from '@/components/ui/MoneyText'
import { useToast } from '@/components/ui/LiveRegion'

/**
 * 월별 평가 양식 — 한 당사자·한 달. 설계: 20_evaluations.sql (사용자 결정 2026-09-25).
 *   ① 월별 예산 사용 평가: 그 달 지출 요약(원장 계산, 읽기) + 서술
 *   ② 계획 이행 정도: 기준 이용계획의 항목(신청 서비스)별 4단계 + 메모(선택 지우기 가능)
 *   ③ 당사자 직접 평가: 당사자가 한 말을 실무자가 그대로 기록(대필)
 *   ④ 종합 소견
 * 달 이동은 부모(아코디언) 패널에 고정돼 있다 — 달이 바뀌어도 누른 버튼이 남아 포커스를 잃지 않게.
 * 초기값은 context 로 한 번만 채운다. 부모가 달·당사자·저장 시각(updatedAt)이 바뀔 때 key 로 다시 마운트한다.
 * 저장 중에는 입력 전체를 잠근다(저장 뒤 서버값으로 다시 마운트될 때 입력이 사라지지 않게).
 */

type ItemState = Record<string, { achievement?: Achievement; note: string }>

export default function EvaluationForm({
  context,
  onSaved,
  onSavingChange,
  onDirtyChange,
  focusStatusOnMount = false,
  locked = false,
}: {
  context: EvaluationContext
  onSaved: () => void
  /** 저장 시작(true)·실패(false)를 알린다. 성공 시 잠금 해제는 부모가 새로고침을 마친 뒤 한다. */
  onSavingChange?: (saving: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
  /** 저장 직후 다시 마운트될 때 '마지막 저장' 줄로 포커스(저장 버튼은 저장 중 잠겨 포커스를 잃는다). */
  focusStatusOnMount?: boolean
  /** 부모 잠금(저장 뒤 새로고침이 끝날 때까지) — 그동안 적은 내용이 다시 마운트로 사라지지 않게 입력을 막는다. */
  locked?: boolean
}) {
  const uid = useId()
  const { announce } = useToast()
  const statusRef = useRef<HTMLParagraphElement>(null)
  // 마운트 때 한 번만(의존성 없음) — 상태 변경 없는 DOM 포커스 이동. layout effect 라 DOM 반영과 같은 커밋(그리기 전)에
  // 옮겨 포커스가 body 에 머무는 틈이 없다. 이 양식은 펼친 뒤 클라이언트에서만 렌더돼 SSR 과 무관하다.
  useLayoutEffect(() => {
    if (focusStatusOnMount) statusRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만 의도(다시 마운트는 부모가 key 로 결정)
  }, [])
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

  function touched() {
    onDirtyChange?.(true)
  }

  function setItem(id: string, patch: Partial<ItemState[string]>) {
    touched()
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], note: prev[id]?.note ?? '', ...patch } }))
  }

  function save() {
    const payloadItems = context.planItems.flatMap((pi) => {
      const it = items[pi.id]
      return it?.achievement ? [{ requestedServiceId: pi.id, achievement: it.achievement, note: it.note }] : []
    })
    // 저장돼 있던 이행도를 이번에 '평가 안 함'으로 되돌린 항목 — 화면에 보인 항목만(안 보인 항목을 지우지 않게).
    const visible = new Set(context.planItems.map((pi) => pi.id))
    const clearedItemIds = context.itemEvaluations
      .map((ie) => ie.requestedServiceId)
      .filter((id) => visible.has(id) && !items[id]?.achievement)
    setError('')
    onSavingChange?.(true)
    startTransition(async () => {
      const result = await saveEvaluation({
        participantId: context.participantId,
        period: context.period,
        budgetUsageNote,
        participantOpinion,
        overallNote,
        items: payloadItems,
        clearedItemIds,
      })
      if (result.error) {
        onSavingChange?.(false)
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      onDirtyChange?.(false)
      announce(`${periodLabel(context.period)} 평가를 저장했어요.`)
      onSaved()
    })
  }

  const { usage } = context
  const textareaClass =
    'w-full p-3 rounded-xl bg-card ring-1 ring-border text-sm text-foreground leading-relaxed min-h-[88px] disabled:bg-disabled-bg disabled:text-disabled-fg'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      {/* 저장 중에는 입력 전체 잠금 — disabled 가 안쪽 입력·버튼·항목 fieldset 에 모두 전파된다. */}
      <fieldset disabled={pending || locked} className="flex flex-col gap-5 min-w-0 border-0 p-0 m-0">
        <legend className="sr-only">{periodLabel(context.period)} 평가 양식</legend>
        <p ref={statusRef} tabIndex={-1} className="text-xs text-muted-foreground">
          {context.evaluation
            ? `마지막 저장 ${formatKSTDateTime(context.evaluation.updatedAt)}`
            : '아직 작성하지 않은 달이에요.'}
        </p>

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
            이 달 예산을 어떻게 썼는지 적어 주세요
          </label>
          <textarea
            id={`${uid}-budget-note`}
            value={budgetUsageNote}
            onChange={(e) => {
              touched()
              setBudgetUsageNote(e.target.value)
            }}
            placeholder="예) 계획한 미술 재료를 샀고, 남은 돈은 다음 달 수영에 쓰기로 했어요."
            className={textareaClass}
          />
        </section>

        {/* ② 계획 이행 정도 (항목별) */}
        <section aria-labelledby={`${uid}-plan`} className="flex flex-col gap-2">
          <h3 id={`${uid}-plan`} className="text-sm font-black text-foreground">② 계획 이행 정도</h3>
          {context.planPeriod && (context.planPeriod.start || context.planPeriod.end) && (
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
                    <fieldset className="flex flex-col gap-2 p-3 rounded-xl ring-1 ring-border min-w-0">
                      <legend className="px-1 text-sm font-bold text-foreground">
                        {pi.priority}. {pi.serviceName}
                        {pi.otherPlan && (
                          <span className="ml-1.5 text-xs font-bold text-warning-fg">(다른 계획의 항목)</span>
                        )}
                      </legend>
                      <p className="text-xs text-muted-foreground">
                        이 달 쓴 돈 <MoneyText value={pi.monthSpent} emphasis="muted" />
                        {pi.estimatedCost != null && (
                          <>
                            {' '}· 계획 전체 예상 <MoneyText value={pi.estimatedCost} emphasis="muted" />
                          </>
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {ACHIEVEMENT_LEVELS.map((l) => {
                          const checked = it.achievement === l.value
                          return (
                            <label
                              key={l.value}
                              className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg ring-1 text-sm font-bold cursor-pointer transition-colors has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground ${
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
                        {it.achievement && (
                          <button
                            type="button"
                            onClick={() => setItem(pi.id, { achievement: undefined })}
                            className="min-h-[44px] px-2 text-xs font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                            aria-label={`${pi.serviceName} 이행 정도 선택 지우기`}
                          >
                            선택 지우기
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={it.note}
                        onChange={(e) => setItem(pi.id, { note: e.target.value })}
                        aria-label={`${pi.serviceName} 이행 메모`}
                        placeholder="메모 (선택) — 예) 매주 참여했어요"
                        className="p-2 rounded-lg bg-card ring-1 ring-border text-sm text-foreground min-h-[44px] disabled:bg-disabled-bg disabled:text-disabled-fg"
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
            onChange={(e) => {
              touched()
              setParticipantOpinion(e.target.value)
            }}
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
            onChange={(e) => {
              touched()
              setOverallNote(e.target.value)
            }}
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
          <Button type="submit" variant="primary" loading={pending || locked}>
            {context.evaluation ? '평가 고쳐서 저장' : '평가 저장'}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
