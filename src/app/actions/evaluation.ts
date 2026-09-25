'use server'

import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { auditLog } from '@/utils/audit'
import { revalidatePath } from 'next/cache'
import { parseMonth } from '@/utils/date'
import {
  isValidPeriod,
  isAchievement,
  summarizeMonthUsage,
  spentByRequestedService,
  evaluationHasContent,
  type Achievement,
  type MonthUsageSummary,
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
}

export interface EvaluationItemValue {
  requestedServiceId: string
  achievement: Achievement
  note: string | null
}

export interface EvaluationContext {
  participantId: string
  period: string
  /** 평가 기준 이용계획의 기간 표시(없으면 null). */
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

/** 표가 아직 없을 때(20_evaluations.sql 미적용) 실무자에게 보일 안내 — 기술 코드 대신 행동 안내. */
function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || /seoul_(plan_item_)?evaluations/.test(error.message ?? '')
}
const NOT_READY = '평가 저장소가 아직 준비되지 않았어요. 관리자에게 알려 주세요.'

/**
 * 한 당사자의 한 달 평가 화면에 필요한 것 — 기준 계획의 항목·그 달 지출 요약·기존 평가/항목 평가·작성된 달 목록.
 * 기준 계획 = 승인(approved/conditional)된 계획 중 그 달을 포함하는 것, 없으면 가장 최근 것.
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
        .select('id, plan_period_start, plan_period_end, created_at')
        .eq('participant_id', participantId)
        .in('status', ['approved', 'conditional'])
        .order('plan_period_start', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
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

    // 그 달(startDate~endDate 전날)을 포함하는 승인 계획 우선, 없으면 가장 최근 승인 계획.
    const plans = plansRes.data ?? []
    const monthLast = endDate // exclusive — 문자열 비교로 충분('YYYY-MM-DD')
    const covering = plans.find(
      (p) => (!p.plan_period_start || p.plan_period_start < monthLast) && (!p.plan_period_end || p.plan_period_end >= startDate),
    )
    const plan = covering ?? plans[0] ?? null

    const usageRows = usagesRes.data ?? []
    const spentByItem = spentByRequestedService(usageRows)

    let planItems: EvaluationPlanItem[] = []
    if (plan) {
      const { data: services } = await supabase
        .from('seoul_requested_services')
        .select('id, priority, service_name, estimated_cost, approved_for_service')
        .eq('plan_id', plan.id)
        .order('priority', { ascending: true })
      planItems = (services ?? [])
        // 조건부 승인에서 '승인 안 된 항목'(false)은 평가 대상이 아니다. null(미기재)은 포함.
        .filter((s) => s.approved_for_service !== false)
        .map((s) => ({
          id: s.id,
          priority: s.priority,
          serviceName: s.service_name,
          estimatedCost: s.estimated_cost == null ? null : Number(s.estimated_cost),
          monthSpent: spentByItem[s.id] ?? 0,
        }))
    }

    let itemEvaluations: EvaluationItemValue[] = []
    const ev = evalRes.data
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

    return {
      context: {
        participantId,
        period,
        planPeriod: plan ? { start: plan.plan_period_start, end: plan.plan_period_end } : null,
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
}

/**
 * 월별 평가 저장(당사자·월 upsert) + 계획 항목별 이행 정도 upsert. 담당 실무자·관리자만(RLS·assertStaff).
 * 남의 계획 항목을 붙이면 DB 무결성 트리거가 거부한다(20_evaluations.sql).
 */
export async function saveEvaluation(
  input: SaveEvaluationInput,
): Promise<{ success?: true; evaluationId?: string; error?: string }> {
  try {
    const { supabase, user } = await assertStaff()

    if (!isValidPeriod(input.period)) return { error: '평가할 달을 다시 골라 주세요.' }
    const items = input.items ?? []
    if (items.some((i) => !isAchievement(i.achievement))) return { error: '이행 정도를 다시 골라 주세요.' }
    if (
      !evaluationHasContent({
        budgetUsageNote: input.budgetUsageNote,
        participantOpinion: input.participantOpinion,
        overallNote: input.overallNote,
        itemCount: items.length,
      })
    ) {
      return { error: '적어도 한 칸은 채워 주세요.' }
    }

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

    if (items.length > 0) {
      const { error: itemError } = await supabase.from('seoul_plan_item_evaluations').upsert(
        items.map((i) => ({
          evaluation_id: ev.id,
          requested_service_id: i.requestedServiceId,
          achievement: i.achievement,
          note: i.note?.trim() || null,
        })),
        { onConflict: 'evaluation_id,requested_service_id' },
      )
      if (itemError) return { error: `이행 정도 저장 실패: ${friendlyDbError(itemError)}` }
    }

    await auditLog(supabase, 'evaluation.save', {
      targetType: 'evaluation',
      targetId: ev.id as string,
      participantId: input.participantId,
      metadata: { period: input.period, items: items.length },
    })

    revalidatePath('/supporter/evaluations')
    revalidatePath(`/supporter/evaluations/${input.participantId}`)
    return { success: true, evaluationId: ev.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}
