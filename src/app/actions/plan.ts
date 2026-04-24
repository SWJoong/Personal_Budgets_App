'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { callOpenAI } from '@/utils/openai'

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
 * 단계 1: 잔액·요일 기반 활동 2가지 추천 (저장된 계획 기반 개인화 포함)
 */
export async function suggestActivityOptions(
  balance: number,
  dayOfWeek: string,
  month: number,
  participantId?: string
): Promise<{ success: boolean; data?: { a: string; b: string }; error?: string }> {
  try {
    // 이전에 저장한 계획에서 활동 목록 조회 (개인화용)
    let recentContext = ''
    if (participantId) {
      const supabase = await createClient()
      const { data: plans } = await supabase
        .from('plans')
        .select('activity_name')
        .eq('participant_id', participantId)
        .order('date', { ascending: false })
        .limit(10)

      const activities = (plans ?? [])
        .map((p: { activity_name: string }) => p.activity_name)
        .filter(Boolean)

      if (activities.length > 0) {
        const unique = [...new Set(activities)].slice(0, 6).join(', ')
        recentContext = `\n이 사람이 최근에 좋아했던 활동들: ${unique}\n이전 활동과 비슷하거나 연관된 것 위주로 추천하되, 가끔은 새로운 활동도 제안해주세요.`
      }
    }

    const result = await callOpenAI([
      {
        role: 'system',
        content: `당신은 발달장애인 성인을 위한 일상 계획 도우미입니다.
사용자는 이번 달 ${balance.toLocaleString()}원이 남아있습니다.
오늘은 ${dayOfWeek}요일(${month}월)입니다.${recentContext}

일상적이고 예산에 맞는 활동 2가지를 추천해주세요.
조건:
- 각 활동명은 10글자 이내
- 예산의 5~25% 수준의 비용
- 현실적인 일상 활동 (식사, 음료, 쇼핑, 산책 등)
- 특수문자(#, &, ~, %, ^, /) 사용 금지

반드시 JSON으로만 응답:
{"a": "활동명A", "b": "활동명B"}`,
      },
      { role: 'user', content: '오늘 할 수 있는 활동을 추천해줘.' },
    ])
    const r = result as { a: string; b: string }
    return { success: true, data: { a: r.a, b: r.b } }
  } catch (error: any) {
    console.error('활동 추천 오류:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 단계 2: 선택한 활동·잔액 기반 방법·비용 2가지 추천
 */
export async function suggestMethodOptions(
  activity: string,
  balance: number
): Promise<{ success: boolean; data?: { a: string; b: string; a_cost: number; b_cost: number }; error?: string }> {
  try {
    const result = await callOpenAI([
      {
        role: 'system',
        content: `당사자가 오늘 "${activity}"을(를) 하려고 합니다.
이번 달 남은 예산은 ${balance.toLocaleString()}원입니다.

이 활동을 하는 2가지 방법을 추천해주세요.
조건:
- 방법 A: 더 간단하거나 저렴한 방법
- 방법 B: 조금 다른 방법 (비용이 달라도 됩니다)
- 각 설명은 15글자 이내
- 예상 비용은 아라비아숫자(원)로 제시

반드시 JSON으로만 응답:
{"a": "방법 설명", "b": "방법 설명", "a_cost": 5000, "b_cost": 7000}`,
      },
      { role: 'user', content: `${activity}을(를) 어떻게 하면 좋을지 추천해줘.` },
    ])
    const r = result as { a: string; b: string; a_cost: number; b_cost: number }
    return {
      success: true,
      data: {
        a: r.a,
        b: r.b,
        a_cost: Number(r.a_cost) || 5000,
        b_cost: Number(r.b_cost) || 10000,
      },
    }
  } catch (error: any) {
    console.error('방법 추천 오류:', error)
    return { success: false, error: error.message }
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
  place_name,
  place_lat,
  place_lng,
}: {
  participantId: string
  activityName: string
  date: string
  options: PlanOption[]
  selectedOptionIndex: number
  details?: PlanContext
  place_name?: string | null
  place_lat?: number | null
  place_lng?: number | null
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
    place_name: place_name ?? null,
    place_lat: place_lat ?? null,
    place_lng: place_lng ?? null,
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
