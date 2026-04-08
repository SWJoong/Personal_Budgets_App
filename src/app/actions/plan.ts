'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

interface PlanOption {
  name: string
  cost: number
  time: string
  icon: string
  description?: string
}

interface PlanContext {
  activity?: string
  when?: string
  where?: string
  who?: string
  why?: string
}

/**
 * 당사자의 현재 잔액과 상황에 맞춰 활동을 추천하는 서버 액션
 */
export async function suggestActivities(currentBalance: number, context?: PlanContext) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('API 키 설정이 필요합니다.');
  }

  const contextLines = context ? [
    context.activity && `하고 싶은 것: ${context.activity}`,
    context.when && `언제: ${context.when}`,
    context.where && `어디서: ${context.where}`,
    context.who && `누구와: ${context.who}`,
    context.why && `이유: ${context.why}`,
  ].filter(Boolean).join('\n') : ''

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `너는 발달장애인 당사자의 자기주도적 예산 관리를 돕는 도우미야.
당사자가 현재 사용할 수 있는 예산은 ${currentBalance}원이야.
${contextLines ? `당사자가 알려준 정보:\n${contextLines}\n` : ''}
이 정보를 바탕으로 예산 범위 내에서 즐길 수 있는 활동 1가지를 정하고, 그 활동을 즐길 수 있는 2가지 방법(저렴한 방법 vs 일반적인 방법)을 추천해줘.
반드시 JSON 형식으로만 답변해줘.

응답 형식 예시:
{
  "activityName": "영화 보기",
  "options": [
    { "name": "조조 영화 보기", "cost": 10000, "time": "2시간", "icon": "🎬", "description": "아침 일찍 저렴하게 영화를 봐요" },
    { "name": "일반 영화 + 팝콘", "cost": 22000, "time": "2시간 30분", "icon": "🍿", "description": "맛있는 팝콘과 함께 영화를 즐겨요" }
  ]
}`
          },
          {
            role: "user",
            content: contextLines ? "내가 알려준 정보에 맞는 활동을 추천해줘." : "오늘 할 수 있는 재미있는 활동을 추천해줘."
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return { success: true, data: result };
  } catch (error: any) {
    console.error('AI 추천 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 당사자의 계획을 DB에 저장
 */
export async function savePlan({
  participantId,
  activityName,
  date,
  options,
  selectedOptionIndex,
  details,
}: {
  participantId: string
  activityName: string
  date: string
  options: PlanOption[]
  selectedOptionIndex: number
  details?: PlanContext
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // 당사자는 profiles 테이블에 행이 없으므로 creator_id FK 위반 방지
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()
  const creator_id = profile ? user.id : null

  const { error } = await supabase.from('plans').insert({
    participant_id: participantId,
    activity_name: activityName,
    date,
    options,
    selected_option_index: selectedOptionIndex,
    creator_id,
    details: details || null,
  })

  if (error) {
    console.error('Plan save error:', error)
    throw new Error('계획 저장에 실패했습니다.')
  }

  revalidatePath('/plan')
  return { success: true }
}

/**
 * 당사자의 저장된 계획 목록 조회
 */
export async function getParticipantPlans(participantId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('participant_id', participantId)
    .order('date', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Plan fetch error:', error)
    return []
  }

  return data || []
}
