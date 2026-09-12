'use server'

import { requireStaff } from '@/utils/supabase/staff'
import { viewAsWriteBlock } from '@/utils/supabase/viewAs'
import { callAIDeidentified } from '@/utils/aiDeidentify'
import { AI_MODELS } from '@/utils/ai'
import { auditLog } from '@/utils/audit'
import { computeReviewSignals, type ReviewInput } from '@/utils/staffReviewSignals'
import {
  REVIEW_SYSTEM,
  buildReviewContext,
  parseReviewSuggestions,
  reviewPiiTerms,
  type ReviewSuggestion,
} from '@/utils/staffReviewSuggestion'

/**
 * 실무자용 AI 점검 제안 생성 — 담당 당사자의 예산 이행·점검 신호를 우선순위 실무 제안으로 합성한다.
 * 설계: Plan&Source/goala_staff_review_assistant_W.md §3. 순수 로직 계약: staffReviewSignals/Suggestion.test.ts.
 *
 * 2층 안전 구조(설계 §1): 결정론적 신호(computeReviewSignals) → 신호 요약만 가명처리해 AI 합성.
 * ★가명처리 게이트: callAI 직접 미사용, callAIDeidentified(json) 만(aiGateBoundary GREEN 유지).
 *   AI_MODELS 는 모델 티어 상수(게이트 무관). basis 는 감지된 kind 로만 통과(환각 차단).
 * ★RLS: requireStaff + 참여자 RLS 스코프 조회(빈값=접근불가)로 담당 당사자만. 신호 0 이면 AI 미호출(비용 0).
 */
export async function generateStaffReviewSuggestions(
  participantId: string,
): Promise<{ suggestions: ReviewSuggestion[] } | { error: string }> {
  // 관리자 둘러보기(view-as) 중에는 유료 AI 호출·감사로그 기록을 막는다.
  const viewAsBlock = await viewAsWriteBlock()
  if (viewAsBlock) return { error: viewAsBlock }

  // 실무자 게이트 — redirect() 가 try 밖에서 정상 전파되도록 try 이전에 호출한다.
  const { supabase } = await requireStaff()

  // 담당 접근 확인 — RLS(admin=전체·담당자=배정) 스코프 조회가 비면 접근 불가로 본다.
  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()
  if (!participant) return { error: '이 당사자 정보를 볼 수 없어요.' }

  try {
    // ── 신호 원시값 수집(모두 RLS 경유·조회 실패는 안전 기본값으로 폴백) ──

    // 예산: 최신 배정 잔액 뷰에서 월 한도·계획외 건수, 월별 소진 뷰에서 최근 달 사용액·초과 여부.
    // (v_seoul_budget_balance 에는 month_spent/exceeds 컬럼이 없어 월별 소진 뷰 v_seoul_monthly_usage 를 함께 본다.)
    const { data: balance } = await supabase
      .from('v_seoul_budget_balance')
      .select('monthly_ceiling, unplanned_count')
      .eq('participant_id', participantId)
      .order('ends_on', { ascending: false })
      .limit(1)
      .maybeSingle()

    let monthSpent = 0
    let monthlyCeiling = Number(balance?.monthly_ceiling ?? 0)
    let exceedsMonthlyCeiling = false
    if (balance) {
      const { data: mu } = await supabase
        .from('v_seoul_monthly_usage')
        .select('month_spent, monthly_ceiling, exceeds_monthly_ceiling')
        .eq('participant_id', participantId)
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (mu) {
        monthSpent = Number(mu.month_spent ?? 0)
        monthlyCeiling = Number(mu.monthly_ceiling ?? monthlyCeiling)
        exceedsMonthlyCeiling = Boolean(mu.exceeds_monthly_ceiling)
      }
    }
    const unplannedCount = Number(balance?.unplanned_count ?? 0)

    // 규칙 점검 대기: 이 당사자의 이용 건에 걸린 pending 점검의 distinct usage 수(관리자 대시보드 G1 과 같은 축).
    // seoul_rule_checks 에는 participant_id 가 없어 이 당사자의 usage id 로 스코프한다.
    let ruleChecksPending = 0
    const { data: usageRows } = await supabase
      .from('seoul_service_usages')
      .select('id')
      .eq('participant_id', participantId)
    const usageIds = (usageRows ?? []).map((u) => u.id)
    if (usageIds.length > 0) {
      const { data: rcRows } = await supabase
        .from('seoul_rule_checks')
        .select('usage_id')
        .in('usage_id', usageIds)
        .eq('human_decision', 'pending')
      ruleChecksPending = new Set((rcRows ?? []).map((r) => r.usage_id)).size
    }

    // 이용계획 상태: 최신 계획의 status(없으면 null).
    const { data: plan } = await supabase
      .from('seoul_utilization_plans')
      .select('status')
      .eq('participant_id', participantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const planStatus: string | null = plan?.status ?? null

    // 관계망: 지역사회 연결 수·전체 관계 수·마지막 접촉 경과일.
    const { data: entities } = await supabase
      .from('seoul_network_entities')
      .select('relation_category, last_contact_date')
      .eq('participant_id', participantId)
    const netRows = entities ?? []
    const totalRelations = netRows.length
    const communityCount = netRows.filter((r) => r.relation_category === 'community').length
    const contactTimes = netRows
      .map((r) => (r.last_contact_date ? new Date(r.last_contact_date).getTime() : NaN))
      .filter((t) => !Number.isNaN(t))
    const lastContactDaysAgo = contactTimes.length
      ? Math.floor((Date.now() - Math.max(...contactTimes)) / 86_400_000)
      : null

    const input: ReviewInput = {
      budget: { monthSpent, monthlyCeiling, exceedsMonthlyCeiling },
      // 자부담 미정산은 현재 스키마에 '납부/정산 완료' 축이 없어 깨끗이 도출 불가 → 0(허위 신호 방지·설계 지침).
      copayUnsettledCount: 0,
      unplannedCount,
      ruleChecksPending,
      planStatus,
      network: { communityCount, lastContactDaysAgo, totalRelations },
    }

    const signals = computeReviewSignals(input)
    // 신호 0(전부 정상) → AI 호출·감사로그 없이 빈 목록(비용 0).
    if (signals.length === 0) return { suggestions: [] }

    const context = buildReviewContext(signals, { participantLabel: '이 당사자' })
    const terms = reviewPiiTerms({ participantName: participant.name })

    const raw = await callAIDeidentified(context, terms, {
      system: REVIEW_SYSTEM,
      model: AI_MODELS.suggest,
      json: true,
      cacheSystem: true,
      maxTokens: 700,
    })

    await auditLog(supabase, 'ai.review', {
      targetType: 'participant',
      targetId: participantId,
      participantId,
      metadata: { model: AI_MODELS.suggest },
    })

    // 환각 가드: basis 가 감지된 kind 안에 있어야 통과.
    return parseReviewSuggestions(raw, { validKinds: signals.map((s) => s.kind) })
  } catch {
    // AI 실패(RateLimit/APIError)·조회 오류 → 친절 메시지, DB 미변경.
    return { error: '점검 제안을 만들지 못했어요. 잠시 후 다시 해주세요.' }
  }
}
