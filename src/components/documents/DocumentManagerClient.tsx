"use client"

import { useState } from 'react'
import { uploadDocument, deleteDocument } from '@/app/actions/document'

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
  initialDocuments 
}: { 
  participants: Participant[]
  initialDocuments: Document[]
}) {
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState(initialDocuments)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      const result = await uploadDocument(formData)
      if (result.success) {
        alert('서류가 성공적으로 등록되었습니다.')
        window.location.reload() // 간단하게 목록 갱신
      }
    } catch (error: any) {
      alert(error.message)
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
              <select name="participant_id" className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-zinc-900 focus:outline-none font-medium" required>
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
                  <span className="text-[10px] text-zinc-400 font-bold ml-1">파일 직접 업로드</span>
                  <input name="file" type="file" className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 font-bold ml-1">또는 외부 링크 (구글 드라이브 등)</span>
                  <input name="url" type="url" placeholder="https://..." className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-zinc-900 focus:outline-none text-sm" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="mt-4 w-full py-4 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:bg-zinc-300">
              {loading ? '처리 중...' : '서류 등록하기'}
            </button>
          </form>
        </div>
      </section>

      {/* 등록된 서류 목록 */}
      <section className="lg:col-span-2">
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
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">등록된 서류가 없습니다.</td>
                </tr>
              ) : (
                documents.map((doc) => (
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
                      {new Date(doc.created_at).toLocaleDateString()}
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
    </div>
  )
}
