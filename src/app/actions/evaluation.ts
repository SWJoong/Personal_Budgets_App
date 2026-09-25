'use server'

import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { auditLog } from '@/utils/audit'
import { revalidatePath } from 'next/cache'
import { parseMonth } from '@/utils/date'
import {
  isValidPeriod,
  isAchievement,
  isFuturePeriod,
  periodInKST,
  summarizeMonthUsage,
  spentByRequestedService,
  evaluationHasContent,
  selectEvaluationPlan,
  type Achievement,
  type MonthUsageSummary,
  type PlanCandidate,
} from '@/utils/evaluation'

/**
 * 월별 평가 — 실무자 전용(RLS: 쓰기 seoul_is_staff_for · 열람 seoul_can_access). 설계: 20_evaluations.sql.
 * 사용자 결정 2026-09-25: 당사자 직접 평가 = 실무자 대필 · 계획 이행 정도 = 계획 항목(신청 서비스)별.
 *
 * 예산 수치(쓴 돈·정산 상태)는 저장하지 않고 조회 시 seoul_service_usages 로 계산한다(원장이 정본).
 */

export interface EvaluationPlanItem {
  id: string
  priority: number
  serviceName: string
  estimatedCost: number | null
  /** 그 달 이 항목으로 쓴 돈(환수 제외). */
  monthSpent: number
  /** 기준 계획 밖이지만 이 달 평가에 이미 이행도가 달린 항목 — 숨기지 않고 보여 준다. */
  otherPlan: boolean
}

export interface EvaluationItemValue {
  requestedServiceId: string
  achievement: Achievement
  note: string | null
}

export interface EvaluationContext {
  participantId: string
  period: string
  /** 평가 기준 이용계획의 유효 기간(배정 → 계획 → 차수 순 보강). 없으면 null. */
  planPeriod: { start: string | null; end: string | null } | null
  planItems: EvaluationPlanItem[]
  usage: MonthUsageSummary
  evaluation: {
    id: string
    budgetUsageNote: string
    participantOpinion: string
    overallNote: string
    updatedAt: string
  } | null
  itemEvaluations: EvaluationItemValue[]
  /** 이미 작성된 달(최근순, 최대 6). */
  recentPeriods: string[]
}

/** 표가 아직 없을 때(20_evaluations.sql 미적용) — PostgREST 스키마 캐시 미발견·PG 미존재 코드만 본다. */
function tableMissing(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}
const NOT_READY = '평가 저장소가 아직 준비되지 않았어요. 관리자에게 알려 주세요.'

/**
 * 한 당사자의 한 달 평가 화면에 필요한 것 — 기준 계획의 항목·그 달 지출 요약·기존 평가/항목 평가·작성된 달 목록.
 * 기준 계획: 그 달 평가가 이미 참조하는 계획(쓸 때에 고정) → 유효 기간이 그 달과 겹치는 승인 계획 → 최근 승인 계획.
 */
export async function getEvaluationContext(
  participantId: string,
  period: string,
): Promise<{ context?: EvaluationContext; error?: string }> {
  try {
    const { supabase } = await assertStaff()
    if (!isValidPeriod(period)) return { error: '평가할 달을 다시 골라 주세요.' }

    // RLS 로 보이지 않는(담당이 아닌) 당사자는 여기서 걸러진다.
    const { data: participant } = await supabase
      .from('participants')
      .select('id')
      .eq('id', participantId)
      .maybeSingle()
    if (!participant) return { error: '당사자 정보를 찾을 수 없어요.' }

    const { startDate, endDate } = parseMonth(`${period}-01`)

    const [plansRes, usagesRes, evalRes, recentRes] = await Promise.all([
      supabase
        .from('seoul_utilization_plans')
        .select('id, status, plan_period_start, plan_period_end, cohort_id, created_at')
        .eq('participant_id', participantId),
      supabase
        .from('seoul_service_usages')
        .select('amount, settlement_status, requested_service_id')
        .eq('participant_id', participantId)
        .gte('usage_date', startDate)
        .lt('usage_date', endDate),
      supabase
        .from('seoul_evaluations')
        .select('id, budget_usage_note, participant_opinion, overall_note, updated_at')
        .eq('participant_id', participantId)
        .eq('period', period)
        .maybeSingle(),
      supabase
        .from('seoul_evaluations')
        .select('period')
        .eq('participant_id', participantId)
        .order('period', { ascending: false })
        .limit(6),
    ])

    if (tableMissing(evalRes.error) || tableMissing(recentRes.error)) return { error: NOT_READY }
    if (evalRes.error) return { error: `평가를 불러오지 못했어요: ${friendlyDbError(evalRes.error)}` }

    // 기존 항목 평가 → 그 평가가 참조하는 계획(anchor).
    const ev = evalRes.data
    let itemEvaluations: EvaluationItemValue[] = []
    if (ev) {
      const { data: items, error: itemsError } = await supabase
        .from('seoul_plan_item_evaluations')
        .select('requested_service_id, achievement, note')
        .eq('evaluation_id', ev.id)
      if (tableMissing(itemsError)) return { error: NOT_READY }
      itemEvaluations = (items ?? [])
        .filter((i) => isAchievement(i.achievement))
        .map((i) => ({ requestedServiceId: i.requested_service_id, achievement: i.achievement as Achievement, note: i.note }))
    }
    const ratedIds = itemEvaluations.map((i) => i.requestedServiceId)
    const { data: ratedServices } = ratedIds.length
      ? await supabase
          .from('seoul_requested_services')
          .select('id, plan_id, priority, service_name, estimated_cost')
          .in('id', ratedIds)
      : { data: [] as { id: string; plan_id: string; priority: number; service_name: string; estimated_cost: number | string | null }[] }
    // 항목들이 여러 계획에 걸쳐 있으면(섞인 과거 기록) 가장 많이 참조된 계획을 기준으로.
    const planVotes = new Map<string, number>()
    for (const s of ratedServices ?? []) planVotes.set(s.plan_id, (planVotes.get(s.plan_id) ?? 0) + 1)
    const anchorPlanId = [...planVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    // 유효 기간 보강: 예산 배정(계획 || 차수로 이미 대체됨) → 계획 기간 → 차수 기간.
    const plans = plansRes.data ?? []
    const planIds = plans.map((p) => p.id)
    const cohortIds = [...new Set(plans.map((p) => p.cohort_id).filter((id): id is string => !!id))]
    const [allocRes, cohortRes] = await Promise.all([
      planIds.length
        ? supabase.from('seoul_budget_allocations').select('plan_id, starts_on, ends_on').in('plan_id', planIds)
        : Promise.resolve({ data: [] as { plan_id: string; starts_on: string; ends_on: string }[] }),
      cohortIds.length
        ? supabase.from('seoul_cohorts').select('id, starts_on, ends_on').in('id', cohortIds)
        : Promise.resolve({ data: [] as { id: string; starts_on: string | null; ends_on: string | null }[] }),
    ])
    const allocByPlan = new Map((allocRes.data ?? []).map((a) => [a.plan_id, a]))
    const cohortById = new Map((cohortRes.data ?? []).map((c) => [c.id, c]))
    const candidates: PlanCandidate[] = plans.map((p) => {
      const alloc = allocByPlan.get(p.id)
      const cohort = p.cohort_id ? cohortById.get(p.cohort_id) : undefined
      return {
        id: p.id,
        status: p.status,
        start: alloc?.starts_on ?? p.plan_period_start ?? cohort?.starts_on ?? null,
        end: alloc?.ends_on ?? p.plan_period_end ?? cohort?.ends_on ?? null,
        createdAt: p.created_at,
      }
    })
    const plan = selectEvaluationPlan(candidates, period, anchorPlanId)

    const usageRows = usagesRes.data ?? []
    const spentByItem = spentByRequestedService(usageRows)
    const toItem = (
      s: { id: string; priority: number; service_name: string; estimated_cost: number | string | null },
      otherPlan: boolean,
    ): EvaluationPlanItem => ({
      id: s.id,
      priority: s.priority,
      serviceName: s.service_name,
      estimatedCost: s.estimated_cost == null ? null : Number(s.estimated_cost),
      monthSpent: spentByItem[s.id] ?? 0,
      otherPlan,
    })

    let planItems: EvaluationPlanItem[] = []
    if (plan) {
      const { data: services } = await supabase
        .from('seoul_requested_services')
        .select('id, priority, service_name, estimated_cost, approved_for_service')
        .eq('plan_id', plan.id)
        .order('priority', { ascending: true })
      planItems = (services ?? [])
        // 조건부 승인에서 '승인 안 된 항목'(false)은 평가 대상이 아니다 — 단 이미 이행도가 달렸으면 보여 준다.
        .filter((s) => s.approved_for_service !== false || ratedIds.includes(s.id))
        .map((s) => toItem(s, false))
    }
    // 기준 계획 밖에 이미 이행도가 달린 항목(섞인 과거 기록 등)도 숨기지 않는다 — 조용히 사라지면 안 된다.
    const shown = new Set(planItems.map((i) => i.id))
    for (const s of ratedServices ?? []) {
      if (!shown.has(s.id)) planItems.push(toItem(s, true))
    }

    return {
      context: {
        participantId,
        period,
        planPeriod: plan ? { start: plan.start, end: plan.end } : null,
        planItems,
        usage: summarizeMonthUsage(usageRows),
        evaluation: ev
          ? {
              id: ev.id,
              budgetUsageNote: ev.budget_usage_note ?? '',
              participantOpinion: ev.participant_opinion ?? '',
              overallNote: ev.overall_note ?? '',
              updatedAt: ev.updated_at,
            }
          : null,
        itemEvaluations,
        recentPeriods: (recentRes.data ?? []).map((r) => r.period as string),
      },
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

export interface SaveEvaluationInput {
  participantId: string
  period: string
  budgetUsageNote?: string
  participantOpinion?: string
  overallNote?: string
  items: { requestedServiceId: string; achievement: Achievement; note?: string }[]
  /** 저장돼 있던 이행도를 '평가 안 함'으로 되돌릴 항목(신청 서비스 id). */
  clearedItemIds?: string[]
}

/**
 * 월별 평가 저장(당사자·월 upsert) + 계획 항목별 이행 정도 upsert/지우기. 담당 실무자·관리자만(RLS·assertStaff).
 * 남의 계획 항목을 붙이면 DB 무결성 트리거가 거부한다(20_evaluations.sql). 지운 뒤 아무 내용도 남지 않으면
 * 빈 평가 행도 지운다(목록에 '최근 평가'로 잘못 보이지 않게).
 */
export async function saveEvaluation(
  input: SaveEvaluationInput,
): Promise<{ success?: true; evaluationId?: string; error?: string }> {
  try {
    const { supabase, user } = await assertStaff()

    if (!isValidPeriod(input.period)) return { error: '평가할 달을 다시 골라 주세요.' }
    if (isFuturePeriod(input.period, periodInKST(new Date()))) return { error: '아직 오지 않은 달은 평가할 수 없어요.' }
    const items = input.items ?? []
    const cleared = (input.clearedItemIds ?? []).filter((id) => !items.some((i) => i.requestedServiceId === id))
    if (items.some((i) => !isAchievement(i.achievement))) return { error: '이행 정도를 다시 골라 주세요.' }
    const hasText = evaluationHasContent({
      budgetUsageNote: input.budgetUsageNote,
      participantOpinion: input.participantOpinion,
      overallNote: input.overallNote,
      itemCount: 0,
    })
    if (!hasText && items.length === 0 && cleared.length === 0) return { error: '적어도 한 칸은 채워 주세요.' }

    const { data: ev, error } = await supabase
      .from('seoul_evaluations')
      .upsert(
        {
          participant_id: input.participantId,
          period: input.period,
          budget_usage_note: input.budgetUsageNote?.trim() || null,
          participant_opinion: input.participantOpinion?.trim() || null,
          overall_note: input.overallNote?.trim() || null,
          authored_by: user.id,
        },
        { onConflict: 'participant_id,period' },
      )
      .select('id')
      .single()

    if (tableMissing(error)) return { error: NOT_READY }
    if (error || !ev) return { error: `평가 저장 실패: ${friendlyDbError(error)}` }
    const evaluationId = ev.id as string

    let itemError: string | null = null
    if (items.length > 0) {
      const { error: e } = await supabase.from('seoul_plan_item_evaluations').upsert(
        items.map((i) => ({
          evaluation_id: evaluationId,
          requested_service_id: i.requestedServiceId,
          achievement: i.achievement,
          note: i.note?.trim() || null,
        })),
        { onConflict: 'evaluation_id,requested_service_id' },
      )
      if (e) itemError = friendlyDbError(e)
    }
    if (!itemError && cleared.length > 0) {
      const { error: e } = await supabase
        .from('seoul_plan_item_evaluations')
        .delete()
        .eq('evaluation_id', evaluationId)
        .in('requested_service_id', cleared)
      if (e) itemError = friendlyDbError(e)
    }

    // 지운 결과 서술도 항목도 없으면 빈 평가 행 정리.
    let removed = false
    if (!itemError && !hasText) {
      const { count } = await supabase
        .from('seoul_plan_item_evaluations')
        .select('id', { count: 'exact', head: true })
        .eq('evaluation_id', evaluationId)
      if (count === 0) {
        const { error: delError } = await supabase.from('seoul_evaluations').delete().eq('id', evaluationId)
        removed = !delError
      }
    }

    // 헤더는 이미 커밋됐으므로 항목 실패여도 감사·캐시 갱신은 한다(부분 저장을 기록에 남김).
    await auditLog(supabase, 'evaluation.save', {
      targetType: 'evaluation',
      targetId: evaluationId,
      participantId: input.participantId,
      metadata: { period: input.period, items: items.length, cleared: cleared.length, removed, itemError: !!itemError },
    })
    revalidatePath('/supporter/evaluations')
    revalidatePath(`/supporter/evaluations/${input.participantId}`)

    if (itemError) return { error: `평가 내용은 저장됐지만 이행 정도 저장에 실패했어요: ${itemError}` }
    return { success: true, evaluationId: removed ? undefined : evaluationId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}
