'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getEvalTemplateSetting } from '@/app/actions/evalTemplates'
import { resolveTemplateFields, resolveAiPrompt } from '@/types/eval-templates'

export async function upsertEvaluation(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const participantId = formData.get('participant_id') as string
  const month = formData.get('month') as string
  const evaluation_template = (formData.get('evaluation_template') as string) || 'pcp'
  const isPcp = evaluation_template === 'pcp'

  // PCP 전용 컬럼
  const tried = isPcp ? formData.get('tried') as string : null
  const learned = isPcp ? formData.get('learned') as string : null
  const pleased = isPcp ? formData.get('pleased') as string : null
  const concerned = isPcp ? formData.get('concerned') as string : null
  const next_step = isPcp ? formData.get('next_step') as string : null

  // 현재 기관 평가 양식 설정 조회
  const setting = await getEvalTemplateSetting()

  // 비PCP: 모든 필드를 template_data JSON으로 수집
  let template_data: Record<string, string> | null = null
  if (!isPcp) {
    const fields = resolveTemplateFields(setting)
    template_data = {}
    for (const field of fields) {
      template_data[field.id] = (formData.get(field.id) as string) || ''
    }
  }

  // AI 분석 자동화 로직
  let ai_analysis = null
  let easy_summary = null

  const apiKey = process.env.OPENAI_API_KEY
  const aiPromptHint = resolveAiPrompt(setting)

  let shouldRunAI = false
  let aiUserContent = ''

  if (isPcp) {
    shouldRunAI = !!(apiKey && (tried || learned || pleased || concerned))
    aiUserContent = `[시도한 것]: ${tried}\n[배운 것]: ${learned}\n[만족하는 것]: ${pleased}\n[고민되는 것]: ${concerned}\n[다음 단계]: ${next_step}`
  } else if (apiKey && template_data) {
    const fields = resolveTemplateFields(setting)
    shouldRunAI = fields.some(f => template_data![f.id])
    aiUserContent = fields.map(f => `[${f.label}]: ${template_data![f.id] || ''}`).join('\n')
  }

  if (shouldRunAI) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `너는 사회복지 전문가이자 발달장애인 당사자의 자기주도적 삶을 돕는 코치야.
              지원자가 작성한 평가 내용을 바탕으로 다음 두 가지를 작성해줘.
              1. supporterAnalysis: 지원자가 향후 어떤 점에 집중해서 지원해야 할지 전문가적 분석 (지원자용)
              2. easySummary: ${aiPromptHint} 당사자가 읽었을 때 이해하기 쉽고 성취감을 느낄 수 있는 따뜻한 2-3문장의 요약 (당사자용)

              반드시 JSON 형식으로 답변해줘: {"supporterAnalysis": "...", "easySummary": "..."}`,
            },
            {
              role: 'user',
              content: aiUserContent,
            },
          ],
          response_format: { type: 'json_object' },
        }),
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
    .upsert(
      {
        participant_id: participantId,
        month,
        evaluation_template,
        tried,
        learned,
        pleased,
        concerned,
        next_step,
        template_data,
        ai_analysis,
        easy_summary,
        creator_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'participant_id, month' }
    )

  if (error) {
    console.error('Evaluation Save Error:', error)
    throw new Error('평가 저장에 실패했습니다.')
  }

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/evaluations')
  return { success: true }
}

export async function publishEvaluation(evaluationId: string, participantId: string, month: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    throw new Error('권한이 없습니다.')
  }

  const { error } = await supabase
    .from('evaluations')
    .update({ published_at: new Date().toISOString() })
    .eq('id', evaluationId)
  if (error) throw new Error('발행에 실패했습니다.')

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/evaluations')
  revalidatePath('/')
  return { success: true }
}

export async function unpublishEvaluation(evaluationId: string, participantId: string, month: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    throw new Error('권한이 없습니다.')
  }

  const { error } = await supabase
    .from('evaluations')
    .update({ published_at: null })
    .eq('id', evaluationId)
  if (error) throw new Error('발행 취소에 실패했습니다.')

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/evaluations')
  revalidatePath('/')
  return { success: true }
}

export async function deleteEvaluation(evaluationId: string, participantId: string, month: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    throw new Error('권한이 없습니다.')
  }

  const { error } = await supabase
    .from('evaluations')
    .delete()
    .eq('id', evaluationId)

  if (error) throw new Error('평가 삭제에 실패했습니다.')

  revalidatePath(`/supporter/evaluations/${participantId}/${month}`)
  revalidatePath('/supporter/evaluations')
  return { success: true }
}
