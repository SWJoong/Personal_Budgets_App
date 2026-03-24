'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { revalidatePath } from 'next/cache'

export async function upsertEvaluation(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const participantId = formData.get('participant_id') as string
  const month = formData.get('month') as string
  
  const tried = formData.get('tried') as string
  const learned = formData.get('learned') as string
  const pleased = formData.get('pleased') as string
  const concerned = formData.get('concerned') as string
  const next_step = formData.get('next_step') as string

  // --- AI 분석 자동화 로직 추가 ---
  let ai_analysis = null
  let easy_summary = null

  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey && (tried || learned || pleased || concerned)) {
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
              content: `너는 사회복지 전문가이자 발달장애인 당사자의 자기주도적 삶을 돕는 코치야. 
              지원자가 작성한 PCP 4+1 평가 내용을 바탕으로 다음 두 가지를 작성해줘.
              1. supporterAnalysis: 지원자가 향후 어떤 점에 집중해서 지원해야 할지 전문가적 분석 (지원자용)
              2. easySummary: 당사자가 읽었을 때 이해하기 쉽고 성취감을 느낄 수 있는 따뜻한 2-3문장의 요약 (당사자용)
              
              반드시 JSON 형식으로 답변해줘: {"supporterAnalysis": "...", "easySummary": "..."}`
            },
            {
              role: "user",
              content: `[시도한 것]: ${tried}\n[배운 것]: ${learned}\n[만족하는 것]: ${pleased}\n[고민되는 것]: ${concerned}\n[다음 단계]: ${next_step}`
            }
          ],
          response_format: { type: "json_object" }
        })
      })

      const aiData = await response.json()
      const result = JSON.parse(aiData.choices[0].message.content)
      ai_analysis = result
      easy_summary = result.easySummary
    } catch (e) {
      console.error('AI 분석 실패:', e)
      // AI 분석 실패해도 저장은 진행
    }
  }

  const { error } = await supabase
    .from('evaluations')
    .upsert({
      participant_id: participantId,
      month,
      tried,
      learned,
      pleased,
      concerned,
      next_step,
      ai_analysis,
      easy_summary,
      creator_id: user.id,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'participant_id, month'
    })

  if (error) {
    console.error('Evaluation Save Error:', error)
    throw new Error('평가 저장에 실패했습니다.')
  }

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/evaluations') // 당사자 화면 갱신
  return { success: true }
}
