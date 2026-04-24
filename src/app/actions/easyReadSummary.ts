'use server'

import { createClient } from '@/utils/supabase/server'
import { callOpenAI } from '@/utils/openai'
import { revalidatePath } from 'next/cache'

function normalizeMonth(month: string): string {
  const m = month.length === 7 ? `${month}-01` : month
  return m.slice(0, 8) + '01'
}

/**
 * 월별계획 + 지원목표에 대해 GPT-4o로 Easy Read 쉬운 설명을 생성하고 DB에 저장합니다.
 * 관리자·실무자만 호출 가능. AI 실패 시 DB 미변경.
 */
export async function generateEasyReadSummary(
  participantId: string,
  month: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    return { error: '권한이 없습니다.' }
  }

  const m = normalizeMonth(month)

  // 월별 계획 조회
  const { data: plans, error: plansErr } = await supabase
    .from('monthly_plans')
    .select('id, title, description, order_index')
    .eq('participant_id', participantId)
    .eq('month', m)
    .order('order_index', { ascending: true })

  if (plansErr) return { error: plansErr.message }

  // 당사자 최신 이용계획서의 지원목표 조회
  const { data: carePlan } = await supabase
    .from('care_plans')
    .select('id')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let goals: { id: string; support_area: string; outcome_goal: string | null }[] = []
  if (carePlan) {
    const { data: goalsData } = await supabase
      .from('support_goals')
      .select('id, support_area, outcome_goal')
      .eq('care_plan_id', carePlan.id)
      .eq('is_active', true)
      .order('order_index', { ascending: true })
    goals = goalsData || []
  }

  if ((!plans || plans.length === 0) && goals.length === 0) {
    return { error: '요약할 계획이나 목표가 없습니다.' }
  }

  const systemPrompt = `당신은 발달장애인을 위한 쉬운 정보(Easy Read) 작성 전문가입니다.
아래 규칙을 반드시 지켜 주세요:
1. 한 문장, 15자 이내
2. 쉬운 우리말만 사용 (한자어·영어·전문 용어 금지)
3. 월별 계획 설명: 행동 중심 ("~해요", "~가요")
4. 지원 목표 설명: 1인칭 ("나는 ~하고 싶어요")
5. 반드시 JSON으로만 응답하세요.`

  const userContent = `다음 내용을 쉽게 설명해 주세요.

월별 계획:
${(plans || []).map(p => `- id: "${p.id}", 제목: "${p.title}"${p.description ? `, 설명: "${p.description}"` : ''}`).join('\n') || '없음'}

지원 목표:
${goals.map(g => `- id: "${g.id}", 지원 영역: "${g.support_area}"${g.outcome_goal ? `, 목표: "${g.outcome_goal}"` : ''}`).join('\n') || '없음'}

응답 형식:
{
  "plans": [{ "id": "uuid", "easy_description": "..." }],
  "goals": [{ "id": "uuid", "easy_description": "..." }]
}`

  let aiResult: { plans?: { id: string; easy_description: string }[]; goals?: { id: string; easy_description: string }[] }

  try {
    aiResult = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]) as typeof aiResult
  } catch (err: any) {
    console.error('Easy Read AI 오류:', err)
    return { error: `AI 생성 실패: ${err.message}` }
  }

  // DB upsert — AI 실패 시 여기 도달하지 않으므로 기존값 보존 보장
  for (const plan of aiResult.plans ?? []) {
    if (!plan.id || !plan.easy_description) continue
    await supabase
      .from('monthly_plans')
      .update({ easy_description: plan.easy_description, updated_at: new Date().toISOString() })
      .eq('id', plan.id)
      .eq('participant_id', participantId)
  }

  for (const goal of aiResult.goals ?? []) {
    if (!goal.id || !goal.easy_description) continue
    await supabase
      .from('support_goals')
      .update({ easy_description: goal.easy_description, updated_at: new Date().toISOString() })
      .eq('id', goal.id)
      .eq('participant_id', participantId)
  }

  revalidatePath(`/supporter/evaluations/${participantId}/${m}/plans`)
  revalidatePath(`/supporter/evaluations/${participantId}`)
  revalidatePath('/')

  return { success: true }
}
