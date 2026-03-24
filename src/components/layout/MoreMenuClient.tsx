"use client"

import { useAccessibility } from '@/hooks/useAccessibility'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FileLink {
  id: string
  title: string
  url: string
  file_type: string
}

export default function MoreMenuClient({ fileLinks }: { fileLinks: FileLink[] }) {
  const { fontSize, setFontSize } = useAccessibility()
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 0. 활동 평가 보기 (신규 추가) */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest ml-2">나의 기록</h3>
        <Link 
          href="/evaluations"
          className="flex items-center justify-between p-6 rounded-[2rem] bg-zinc-900 text-white shadow-xl hover:bg-zinc-800 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl group-hover:scale-110 transition-transform">💌</span>
            <div className="flex flex-col">
              <span className="text-lg font-black">지원자 선생님의 편지</span>
              <span className="text-xs font-bold text-zinc-400">나의 한 달 활동 이야기 보기</span>
            </div>
          </div>
          <span className="text-2xl">→</span>
        </Link>
      </section>

      {/* 1. 글자 크기 설정 (Epic 9) */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest ml-2">화면 설정</h3>
        <div className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm flex flex-col gap-4">
          <p className="text-sm font-bold text-zinc-600 mb-1">글자 크기를 조절할 수 있습니다.</p>
          <div className="flex gap-2">
            {[
              { id: 'normal', label: '가', size: '기본' },
              { id: 'large', label: '가', size: '크게' },
              { id: 'huge', label: '가', size: '매우 크게' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setFontSize(s.id as any)}
                className={`flex-1 flex flex-col items-center justify-center py-4 rounded-2xl transition-all border-2
                  ${fontSize === s.id 
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg scale-105' 
                    : 'bg-zinc-50 border-transparent text-zinc-400 hover:bg-zinc-100'}
                `}
              >
                <span className={`font-black ${s.id === 'normal' ? 'text-sm' : s.id === 'large' ? 'text-xl' : 'text-3xl'}`}>
                  {s.label}
                </span>
                <span className="text-[10px] font-bold mt-1">{s.size}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. 내 서류함 (Epic 8) */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest ml-2">내 서류함</h3>
        <div className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm flex flex-col gap-3">
          {fileLinks.length === 0 ? (
            <div className="py-8 text-center text-zinc-400">
              <span className="text-4xl block mb-2">📁</span>
              <p className="text-sm font-bold">아직 등록된 서류가 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {fileLinks.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-zinc-800">{file.title}</span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">{file.file_type}</span>
                    </div>
                  </div>
                  <span className="text-zinc-300 group-hover:text-zinc-900 transition-colors">→</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. 계정 관리 */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest ml-2">계정 관리</h3>
        <button
          onClick={handleLogout}
          className="w-full p-5 rounded-[2rem] bg-red-50 text-red-600 font-black text-center ring-1 ring-red-100 hover:bg-red-100 transition-all active:scale-95"
        >
          안전하게 로그아웃
        </button>
      </section>
    </div>
  )
}
