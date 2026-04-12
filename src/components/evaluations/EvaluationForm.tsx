"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertEvaluation, deleteEvaluation, publishEvaluation, unpublishEvaluation } from '@/app/actions/evaluation'

interface Props {
  participantId: string
  month: string
  initialData?: any
}

export default function EvaluationForm({ participantId, month, initialData }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [publishedAt, setPublishedAt] = useState<string | null>(initialData?.published_at ?? null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMessage('')
    try {
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

  async function handleDelete() {
    if (!initialData?.id) return
    if (!confirm('정말로 이 평가를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

    setDeleting(true)
    setMessage('')
    try {
      await deleteEvaluation(initialData.id, participantId, month)
      setMessage('✅ 평가가 삭제되었습니다.')
      router.push('/supporter/evaluations')
    } catch (e: any) {
      setMessage('❌ 삭제에 실패했습니다: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handlePublish() {
    if (!initialData?.id) return
    setPublishing(true)
    setMessage('')
    try {
      if (publishedAt) {
        await unpublishEvaluation(initialData.id, participantId, month)
        setPublishedAt(null)
        setMessage('✅ 발행이 취소되었습니다. 당사자 화면에서 숨겨집니다.')
      } else {
        await publishEvaluation(initialData.id, participantId, month)
        setPublishedAt(new Date().toISOString())
        setMessage('✅ 당사자에게 발행되었습니다. 당사자 화면에 표시됩니다.')
      }
    } catch (e: any) {
      setMessage('❌ 오류: ' + e.message)
    } finally {
      setPublishing(false)
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

      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={loading || deleting}
          className="flex-1 py-5 rounded-3xl bg-zinc-900 text-white text-xl font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all relative overflow-hidden"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <span className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              AI 분석 중...
            </span>
          ) : '📝 평가 저장하기'}
        </button>

        {initialData?.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || deleting}
            className="px-6 py-5 rounded-3xl bg-red-500 text-white text-lg font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all hover:bg-red-600"
          >
            {deleting ? '삭제 중...' : '🗑️ 삭제'}
          </button>
        )}
      </div>

      {initialData?.id && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="h-px bg-zinc-200" />
          {publishedAt ? (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-green-50 border border-green-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-sm font-black text-green-800">당사자에게 발행됨</p>
                  <p className="text-xs text-green-600">
                    {new Date(publishedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 rounded-xl bg-white ring-1 ring-green-300 text-green-700 text-sm font-black hover:bg-green-100 transition-all disabled:opacity-50"
              >
                {publishing ? '처리 중...' : '발행 취소'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || loading}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-base hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
            >
              {publishing
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />발행 중...</>
                : '💌 당사자에게 발행하기'}
            </button>
          )}
        </div>
      )}
    </form>
  )
}
