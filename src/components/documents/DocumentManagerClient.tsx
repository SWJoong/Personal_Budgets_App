"use client"

import { useState } from 'react'
import { uploadDocument, deleteDocument, getDocumentUploadUrl, saveDocumentRecord } from '@/app/actions/document'
import { createClient } from '@/utils/supabase/client'
import SisASection from '@/components/documents/SisASection'
import type { SisAssessmentRow } from '@/app/actions/sisAssessment'

interface Participant {
  id: string
  name?: string
}

interface Document {
  id: string
  title: string
  url: string
  file_type: string
  participant_id: string
  created_at: string
  participant?: { name?: string } | null
}

export default function DocumentManagerClient({
  participants,
  initialDocuments,
  sisAssessments = [],
  initialParticipantId,
}: {
  participants: Participant[]
  initialDocuments: Document[]
  sisAssessments?: SisAssessmentRow[]
  initialParticipantId?: string
}) {
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState(initialDocuments)
  const [fileError, setFileError] = useState('')
  const [filterParticipantId, setFilterParticipantId] = useState(initialParticipantId || '')

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && file.size > MAX_FILE_SIZE) {
      setFileError(`파일 용량이 너무 큽니다. (${(file.size / 1024 / 1024).toFixed(1)}MB → 최대 20MB)`)
      e.target.value = ''
    } else {
      setFileError('')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (fileError) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const file = formData.get('file') as File | null
    const participantId = formData.get('participant_id') as string
    const title = formData.get('title') as string
    const fileType = formData.get('file_type') as string
    const externalUrl = formData.get('url') as string

    if (file && file.size > MAX_FILE_SIZE) {
      setFileError(`파일 용량이 너무 큽니다. (최대 20MB)`)
      return
    }

    setLoading(true)
    try {
      if (file && file.size > 0) {
        // 파일 업로드: 브라우저 → Supabase Storage 직접 전송 (Vercel 4.5MB 제한 우회)
        const urlResult = await getDocumentUploadUrl(participantId, file.name)
        if ('error' in urlResult) throw new Error(urlResult.error)

        const supabase = createClient()
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .uploadToSignedUrl(urlResult.path, urlResult.token, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          })
        if (uploadError) throw new Error('파일 업로드 실패: ' + uploadError.message)

        const saveResult = await saveDocumentRecord(participantId, title, fileType, urlResult.path)
        if ('error' in saveResult) throw new Error(saveResult.error)
      } else {
        // URL만 등록하는 경우
        const result = await uploadDocument(formData)
        if (!result.success) throw new Error('저장 실패')
      }

      alert('서류가 성공적으로 등록되었습니다.')
      window.location.reload()
    } catch (error: any) {
      alert(error.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await deleteDocument(id)
      setDocuments(documents.filter(d => d.id !== id))
    } catch (error) {
      alert('삭제 실패')
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* SIS-A 척도 관리 섹션 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">SIS-A 지원요구척도</h2>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold">원점수 입력 → 표준점수 자동 변환</span>
        </div>
        <SisASection participants={participants} initialAssessments={sisAssessments} />
      </section>

      <div className="h-px bg-zinc-200" />

      {/* 파일/링크 서류 관리 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 서류 등록 폼 */}
      <section className="lg:col-span-1">
        <div className="bg-white rounded-2xl p-6 ring-1 ring-zinc-200 shadow-sm sticky top-24">
          <h2 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
            <span>➕</span> 새 서류 등록
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">대상 당사자</label>
              <select name="participant_id" defaultValue={initialParticipantId || ''} className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-zinc-900 focus:outline-none font-medium" required>
                <option value="">당사자를 선택하세요</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">서류 제목</label>
              <input name="title" type="text" placeholder="예: 3월 활동 계획서" className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-zinc-900 focus:outline-none" required />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">서류 종류</label>
              <select name="file_type" className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-zinc-900 focus:outline-none font-medium" required>
                <option value="계획서">계획서</option>
                <option value="평가서">평가서</option>
                <option value="참고자료">참고자료</option>
                <option value="증빙자료">증빙자료</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">업로드 방식</label>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between ml-1">
                    <span className="text-[10px] text-zinc-400 font-bold">파일 직접 업로드</span>
                    <span className="text-[10px] text-zinc-400">최대 20MB</span>
                  </div>
                  <input
                    name="file"
                    type="file"
                    onChange={handleFileChange}
                    className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                  />
                  {fileError && (
                    <p className="text-xs text-red-500 font-bold mt-1 ml-1">{fileError}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 font-bold ml-1">또는 외부 링크 (구글 드라이브 등)</span>
                  <input name="url" type="url" placeholder="https://..." className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-zinc-900 focus:outline-none text-sm" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading || !!fileError} className="mt-4 w-full py-4 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:bg-zinc-300">
              {loading ? '처리 중...' : '서류 등록하기'}
            </button>
          </form>
        </div>
      </section>

      {/* 등록된 서류 목록 */}
      <section className="lg:col-span-2">
        {/* 당사자 필터 */}
        <div className="flex items-center gap-3 mb-3">
          <select
            value={filterParticipantId}
            onChange={e => setFilterParticipantId(e.target.value)}
            className="p-2.5 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium text-sm focus:ring-zinc-400 focus:outline-none"
          >
            <option value="">전체 당사자</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {filterParticipantId && (
            <button onClick={() => setFilterParticipantId('')} className="text-xs text-zinc-400 hover:text-zinc-600 font-bold">
              필터 해제
            </button>
          )}
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-zinc-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">서류 제목</th>
                <th className="px-6 py-4">대상자</th>
                <th className="px-6 py-4">종류</th>
                <th className="px-6 py-4">날짜</th>
                <th className="px-6 py-4 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {documents.filter(d => !filterParticipantId || d.participant_id === filterParticipantId).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">등록된 서류가 없습니다.</td>
                </tr>
              ) : (
                documents.filter(d => !filterParticipantId || d.participant_id === filterParticipantId).map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-900 hover:text-primary transition-colors flex items-center gap-2">
                        📄 {doc.title}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {doc.participant?.name || '알 수 없음'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-md bg-zinc-100 text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400">
                      {doc.created_at.slice(0, 10)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(doc.id)} className="text-red-400 hover:text-red-600 text-sm font-bold transition-colors">삭제</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div> {/* end grid (파일/링크 서류 관리) */}
    </div>
  )
}
