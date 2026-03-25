"use client"

import { useState } from 'react'
import { upsertEvaluation } from '@/app/actions/evaluation'

interface Props {
  participantId: string
  month: string
  initialData?: any
}

export default function EvaluationForm({ participantId, month, initialData }: Props) {
  const [loading, setLoading] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMessage('')
    try {
      // 1단계: 저장 시작 (AI 분석 포함)
      setAiProcessing(true)
      setMessage('📝 평가를 저장하고 AI가 분석하고 있어요...')
      
      const result = await upsertEvaluation(formData)
      if (result.success) {
        setAiProcessing(false)
        setMessage('✅ 평가가 성공적으로 저장되었습니다.')
      }
    } catch (e: any) {
      setAiProcessing(false)
      setMessage('❌ 저장에 실패했습니다: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const questions = [
    { id: 'tried', label: '1. 시도한 것 (What have we tried?)', placeholder: '이번 달에 새롭게 시도한 활동이나 방법은 무엇인가요?', value: initialData?.tried },
    { id: 'learned', label: '2. 배운 것 (What have we learned?)', placeholder: '시도한 활동을 통해 당사자나 지원자가 알게 된 사실은 무엇인가요?', value: initialData?.learned },
    { id: 'pleased', label: '3. 만족하는 것 (What are we pleased about?)', placeholder: '잘 진행되었거나 당사자가 즐거워했던 부분은 무엇인가요?', value: initialData?.pleased },
    { id: 'concerned', label: '4. 고민되는 것 (What are we concerned about?)', placeholder: '어려움이 있었거나 개선이 필요한 부분은 무엇인가요?', value: initialData?.concerned },
    { id: 'next_step', label: '+1. 향후 계획 (What are we going to do next?)', placeholder: '다음 달에는 어떤 점을 다르게 하거나 새로 시도해볼까요?', value: initialData?.next_step },
  ]

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="participant_id" value={participantId} />
      <input type="hidden" name="month" value={month} />

      {message && (
        <div className={`p-4 rounded-xl font-bold text-sm flex items-center gap-3 ${
          message.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 
          message.startsWith('❌') ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {aiProcessing && (
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      {questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-2">
          <label htmlFor={q.id} className="text-sm font-black text-zinc-700 ml-1 italic">
            {q.label}
          </label>
          <textarea
            id={q.id}
            name={q.id}
            defaultValue={q.value || ''}
            placeholder={q.placeholder}
            rows={4}
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base leading-relaxed transition-all"
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full py-5 rounded-3xl bg-zinc-900 text-white text-xl font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all relative overflow-hidden"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <span className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            AI 분석 중...
          </span>
        ) : '📝 평가 저장하기'}
      </button>
    </form>
  )
}
