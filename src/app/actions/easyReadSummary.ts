'use server'

import { assertStaff } from '@/utils/supabase/staff'
import { callAIDeidentified } from '@/utils/aiDeidentify'
import { AI_MODELS } from '@/utils/ai'
import { auditLog } from '@/utils/audit'
import {
  EASY_READ_SYSTEM,
  buildSummarySource,
  summaryPiiTerms,
  type SummaryRequestedService,
} from '@/utils/easyReadSummary'

/**
 * 쉬운말 요약 생성 — 담당자/관리자가 참여자 이용계획을 '쉬운 정보'로 자동 요약한다.
 * 설계: Plan&Source/goala_ai_client_W.md §3. 순수 로직 계약: src/utils/easyReadSummary.test.ts.
 *
 * ★가명처리 게이트: 원문(자기서술·서비스)에 이름·기관이 있을 수 있어 callAI 를 직접 부르지 않고
 *   callAIDeidentified(원문, terms) 만 쓴다(경계 테스트 aiGateBoundary.test.ts 가 회귀 차단).
 *   AI_MODELS 는 모델 티어 상수일 뿐 callAI 함수가 아니다(게이트 무관).
 * 이번 범위 = 생성·반환(무저장). 저장 캐싱(참여자·기간 키)은 후속(W seoul_easy_read_summaries 계약).
 */
export async function generateEasyReadSummary(
  planId: string,
): Promise<{ summary: string } | { error: string }> {
  try {
    const { supabase } = await assertStaff()

    const { data: plan, error: planErr } = await supabase
      .from('seoul_utilization_plans')
      .select('id, participant_id, plan_period_start, plan_period_end')
      .eq('id', planId)
      .maybeSingle()
    if (planErr) return { error: '계획을 불러오지 못했어요.' }
    if (!plan) return { error: '이 계획을 볼 권한이 없거나 존재하지 않아요.' }

    const [{ data: narrative }, { data: services }, { data: participant }] = await Promise.all([
      supabase
        .from('seoul_self_narratives')
        .select('strengths_talents, social_barriers, desired_change, desired_life, goal_to_try')
        .eq('plan_id', planId)
        .maybeSingle(),
      supabase
        .from('seoul_requested_services')
        .select('service_name, priority, estimated_cost')
        .eq('plan_id', planId),
      supabase.from('profiles').select('name, full_name').eq('id', plan.participant_id).maybeSingle(),
    ])

    const requestedServices: SummaryRequestedService[] = (services ?? []).map((s) => ({
      serviceName: s.service_name,
      priority: s.priority,
      estimatedCost: s.estimated_cost,
    }))

    const source = buildSummarySource({
      periodStart: plan.plan_period_start,
      periodEnd: plan.plan_period_end,
      narrative: narrative
        ? {
            strengthsTalents: narrative.strengths_talents,
            socialBarriers: narrative.social_barriers,
            desiredChange: narrative.desired_change,
            desiredLife: narrative.desired_life,
            goalToTry: narrative.goal_to_try,
          }
        : null,
      requestedServices,
    })

    if (!source.trim()) {
      return { error: '요약할 내용이 아직 없어요. 자기서술이나 받고 싶은 도움을 먼저 적어 주세요.' }
    }

    const participantName = participant?.name ?? participant?.full_name ?? null
    const terms = summaryPiiTerms({ participantName })

    const summary = await callAIDeidentified(source, terms, {
      system: EASY_READ_SYSTEM,
      model: AI_MODELS.summary,
      maxTokens: 700,
      cacheSystem: true,
    })

    await auditLog(supabase, 'ai.summary', {
      targetType: 'plan',
      targetId: planId,
      metadata: { model: AI_MODELS.summary },
    })

    return { summary: summary.trim() }
  } catch (e) {
    // AI 실패(RateLimit/APIError)·권한 오류 → 친절 메시지, DB 미변경.
    const msg = e instanceof Error ? e.message : '오류가 발생했어요.'
    return { error: `요약을 만들지 못했어요. 잠시 후 다시 해주세요. (${msg})` }
  }
}
