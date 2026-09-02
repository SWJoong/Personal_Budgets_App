'use server'

import { createClient } from '@/utils/supabase/server'
import { getCurrentParticipant } from '@/utils/supabase/participant'
import { callAIDeidentified } from '@/utils/aiDeidentify'
import { AI_MODELS } from '@/utils/ai'
import { buildBudgetByDomain, type PlannedServiceRow } from '@/utils/budgetByDomain'
import type { DomainSpine, DomainFlowRow } from '@/utils/domainAxisReport'
import {
  SUGGEST_SYSTEM,
  buildSuggestionContext,
  parseSuggestions,
  suggestionPiiTerms,
  type ActivitySuggestion,
  type SuggestionDomainContext,
} from '@/utils/activitySuggestion'

/**
 * 활동 제안 생성 — 당사자 본인이 자기 '남은 돈' 안에서 해볼 만한 활동을 AI 로 추천받는다.
 * 설계: Plan&Source/goala_ai_client_W.md §4. 순수 로직 계약: src/utils/activitySuggestion.test.ts.
 * 참여자 self — getCurrentParticipant + RLS 로 본인 데이터만. 예산 조립은 참여자 홈과 동일 기준.
 *
 * ★가명처리 게이트: callAI 직접 미사용, callAIDeidentified(json) 만 쓴다(aiGateBoundary GREEN 유지).
 *   AI_MODELS 는 모델 티어 상수(게이트 무관). 파싱은 validDomainIds 로 환각 domain 을 차단.
 * 이번 범위 = 영역별 잔액 기반. '가까운 제공기관' 연계(자산지도)·저장은 후속.
 */
export async function generateActivitySuggestions(): Promise<
  { suggestions: ActivitySuggestion[] } | { error: string }
> {
  try {
    const supabase = await createClient()
    const participant = await getCurrentParticipant()
    if (!participant) return { error: '내 정보를 아직 찾지 못했어요. 담당 선생님에게 말해 주세요.' }

    const { data: balance } = await supabase
      .from('v_seoul_budget_balance')
      .select('allocation_id')
      .eq('participant_id', participant.id)
      .order('ends_on', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!balance) return { error: '예산 정보가 아직 없어요. 담당 선생님에게 말해 주세요.' }

    const [{ data: alloc }, { data: domains }, { data: flow }] = await Promise.all([
      supabase.from('seoul_budget_allocations').select('plan_id').eq('id', balance.allocation_id).maybeSingle(),
      supabase.from('seoul_service_domains').select('id, label, sort_order').eq('program', 'seoul'),
      supabase.from('v_seoul_domain_flow').select('*').eq('participant_id', participant.id),
    ])

    let planned: PlannedServiceRow[] = []
    if (alloc?.plan_id) {
      const { data: requested } = await supabase
        .from('seoul_requested_services')
        .select('domain_id, estimated_cost')
        .eq('plan_id', alloc.plan_id)
      planned = (requested ?? []).map((r) => ({ domain_id: r.domain_id, estimated_cost: r.estimated_cost }))
    }

    const rows = buildBudgetByDomain(
      (domains ?? []) as DomainSpine[],
      planned,
      (flow ?? []) as DomainFlowRow[],
    )

    const domainContexts: SuggestionDomainContext[] = rows.map((r) => ({
      domainId: r.domainId,
      domainLabel: r.label,
      remaining: r.remaining,
    }))

    // 남은 예산이 있는 영역이 없으면 제안 없음 — AI 호출을 아낀다.
    const validDomainIds = domainContexts.filter((d) => d.remaining > 0).map((d) => d.domainId)
    if (validDomainIds.length === 0) return { suggestions: [] }

    const context = buildSuggestionContext({ domains: domainContexts })
    const terms = suggestionPiiTerms({ participantName: participant.name })

    const raw = await callAIDeidentified(context, terms, {
      system: SUGGEST_SYSTEM,
      model: AI_MODELS.suggest,
      maxTokens: 500,
      json: true,
      cacheSystem: true,
    })

    return parseSuggestions(raw, { validDomainIds })
  } catch (e) {
    // AI 실패(RateLimit/APIError)·조회 오류 → 친절 메시지, DB 미변경.
    const msg = e instanceof Error ? e.message : '오류가 발생했어요.'
    return { error: `활동 제안을 만들지 못했어요. 잠시 후 다시 해주세요. (${msg})` }
  }
}
