"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertEvaluation, deleteEvaluation, publishEvaluation, unpublishEvaluation } from '@/app/actions/evaluation'
import type { EvalField, EvalTemplateId } from '@/types/eval-templates'

interface Props {
  participantId: string
  month: string
  initialData?: any
  templateId?: EvalTemplateId
  templateFields?: EvalField[]
}

export default function EvaluationForm({ participantId, month, initialData, templateId = 'pcp', templateFields }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(initialData?.published_at ?? null)
  const [savedId, setSavedId] = useState<string | null>(initialData?.id ?? null)

  function showToast(type: 'success' | 'error' | 'info', message: string, duration = 4000) {
    setToast({ type, message })
    if (duration > 0) setTimeout(() => setToast(null), duration)
  }

  async function handleSubmit(formData: FormData, andPublish = false) {
    setLoading(true)
    try {
      setAiProcessing(true)
      showToast('info', '📝 평가를 저장하고 AI가 분석하고 있어요...', 0)

      const result = await upsertEvaluation(formData)
      setAiProcessing(false)
      if (result.success) {
        if (andPublish && (savedId || initialData?.id)) {
          await publishEvaluation(savedId || initialData!.id, participantId, month)
          setPublishedAt(new Date().toISOString())
          showToast('success', '✅ 평가가 저장되고 당사자에게 발행되었습니다.')
        } else {
          showToast('success', '✅ 평가가 성공적으로 저장되었습니다.')
        }
      }
    } catch (e: any) {
      setAiProcessing(false)
      showToast('error', '❌ 저장에 실패했습니다: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!initialData?.id && !savedId) return
    if (!confirm('정말로 이 평가를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

    setDeleting(true)
    try {
      await deleteEvaluation(savedId || initialData!.id, participantId, month)
      showToast('success', '✅ 평가가 삭제되었습니다.')
      router.push('/supporter/evaluations')
    } catch (e: any) {
      showToast('error', '❌ 삭제에 실패했습니다: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handlePublish() {
    if (!initialData?.id && !savedId) return
    setPublishing(true)
    try {
      if (publishedAt) {
        await unpublishEvaluation(savedId || initialData!.id, participantId, month)
        setPublishedAt(null)
        showToast('success', '✅ 발행이 취소되었습니다. 당사자 화면에서 숨겨집니다.')
      } else {
        await publishEvaluation(savedId || initialData!.id, participantId, month)
        setPublishedAt(new Date().toISOString())
        showToast('success', '✅ 당사자에게 발행되었습니다. 당사자 화면에 표시됩니다.')
      }
    } catch (e: any) {
      showToast('error', '❌ 오류: ' + e.message)
    } finally {
      setPublishing(false)
    }
  }

  // PCP: 기존 컬럼에서 값을 읽음 / 비PCP: template_data JSON에서 읽음
  const isPcp = templateId === 'pcp'
  const templateData = initialData?.template_data as Record<string, string> | null | undefined

  // 기존 PCP 컬럼 매핑
  const PCP_FIELD_VALUES: Record<string, string | null> = {
    tried: initialData?.tried ?? '',
    learned: initialData?.learned ?? '',
    pleased: initialData?.pleased ?? '',
    concerned: initialData?.concerned ?? '',
    next_step: initialData?.next_step ?? '',
  }

  const defaultFields: EvalField[] = [
    { id: 'tried',     label: '1. 시도한 것 (What have we tried?)',        placeholder: '이번 달에 새롭게 시도한 활동이나 방법은 무엇인가요?',         rows: 4 },
    { id: 'learned',   label: '2. 배운 것 (What have we learned?)',         placeholder: '시도한 활동을 통해 당사자나 지원자가 알게 된 사실은 무엇인가요?', rows: 4 },
    { id: 'pleased',   label: '3. 만족하는 것 (What are we pleased about?)', placeholder: '잘 진행되었거나 당사자가 즐거워했던 부분은 무엇인가요?',        rows: 4 },
    { id: 'concerned', label: '4. 고민되는 것 (What are we concerned about?)',placeholder: '어려움이 있었거나 개선이 필요한 부분은 무엇인가요?',          rows: 4 },
    { id: 'next_step', label: '+1. 향후 계획 (What are we going to do next?)',placeholder: '다음 달에는 어떤 점을 다르게 하거나 새로 시도해볼까요?',     rows: 4 },
  ]

  const fields = templateFields ?? defaultFields

  const questions = fields.map(f => ({
    id: f.id,
    label: f.label,
    placeholder: f.placeholder,
    rows: f.rows,
    value: isPcp
      ? (PCP_FIELD_VALUES[f.id] ?? '')
      : (templateData?.[f.id] ?? ''),
  }))

  return (
    <>
      <form
        action={(fd) => handleSubmit(fd, false)}
        className="flex flex-col gap-6"
        id="eval-form"
      >
        <input type="hidden" name="participant_id" value={participantId} />
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="evaluation_template" value={templateId} />

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
              rows={q.rows ?? 4}
              className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base leading-relaxed transition-all"
            />
          </div>
        ))}

        {/* 저장 + 저장 후 발행 + 삭제 버튼 한 줄 */}
        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            disabled={loading || deleting}
            className="flex-1 py-4 rounded-2xl bg-zinc-900 text-white font-black text-base shadow-lg active:scale-95 disabled:bg-zinc-300 transition-all flex items-center justify-center gap-2"
          >
            {loading && !aiProcessing
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />저장 중...</>
              : '📝 저장'}
          </button>

          {!publishedAt && (
            <button
              type="button"
              disabled={loading || deleting || publishing}
              onClick={async () => {
                const form = document.getElementById('eval-form') as HTMLFormElement
                if (!form) return
                const fd = new FormData(form)
                await handleSubmit(fd, true)
              }}
              className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black text-base shadow-lg active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:bg-blue-700"
            >
              {(loading || publishing)
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />처리 중...</>
                : '💌 저장 후 발행'}
            </button>
          )}

          {(savedId || initialData?.id) && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || deleting}
              className="px-5 py-4 rounded-2xl bg-red-100 text-red-600 font-bold text-sm active:scale-95 disabled:opacity-50 transition-all hover:bg-red-200"
            >
              {deleting ? '삭제 중...' : '🗑️'}
            </button>
          )}
        </div>

        {/* 발행된 경우: 발행 취소 버튼 */}
        {publishedAt && (
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
        )}
      </form>

      {/* 하단 고정 Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-xl font-bold text-sm flex items-center gap-3 max-w-sm w-full transition-all animate-fade-in-up ${
          toast.type === 'success' ? 'bg-green-700 text-white' :
          toast.type === 'error' ? 'bg-red-700 text-white' :
          'bg-zinc-900 text-white'
        }`}>
          {aiProcessing && (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>
      )}
    </>
  )
}
