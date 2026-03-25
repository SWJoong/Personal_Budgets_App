'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'

interface Props {
  profile: {
    id: string
    name: string | null
    role: string
    bio: string | null
    avatar_url: string | null
  }
  userEmail: string
  isAdminEmail: boolean
}

export default function ProfileEditClient({ profile, userEmail, isAdminEmail }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setToast(null)

    try {
      const formData = new FormData(e.currentTarget)
      await updateProfile(formData)
      setToast({ type: 'success', message: '프로필이 저장되었습니다.' })
      router.refresh()
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || '저장 실패' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {toast && (
        <div className={`p-4 rounded-2xl text-sm font-bold animate-fade-in-up ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center text-4xl overflow-hidden ring-4 ring-zinc-200">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="프로필" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-black text-zinc-400">{(profile.name || '?')[0]}</span>
          )}
        </div>
        <p className="text-xs text-zinc-400 font-bold">{userEmail}</p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">이름</label>
        <input
          name="name"
          type="text"
          defaultValue={profile.name || ''}
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
          required
        />
      </div>

      {/* Role */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">역할</label>
        {isAdminEmail ? (
          <div className="p-4 rounded-2xl bg-red-50 ring-1 ring-red-200">
            <input type="hidden" name="role" value="admin" />
            <div className="flex items-center gap-2">
              <span className="text-xl">🔑</span>
              <span className="font-bold text-red-600">관리자 (자동 지정)</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex flex-col items-center p-4 rounded-2xl cursor-pointer transition-all ring-2 ${
              profile.role === 'participant' ? 'ring-primary bg-primary/5' : 'ring-zinc-200'
            }`}>
              <input type="radio" name="role" value="participant" defaultChecked={profile.role === 'participant'} className="sr-only" />
              <span className="text-2xl mb-1">🙋</span>
              <span className="text-sm font-bold">사용자</span>
            </label>
            <label className={`flex flex-col items-center p-4 rounded-2xl cursor-pointer transition-all ring-2 ${
              profile.role === 'supporter' ? 'ring-primary bg-primary/5' : 'ring-zinc-200'
            }`}>
              <input type="radio" name="role" value="supporter" defaultChecked={profile.role === 'supporter'} className="sr-only" />
              <span className="text-2xl mb-1">🤝</span>
              <span className="text-sm font-bold">지원자</span>
            </label>
          </div>
        )}
      </div>

      {/* Bio */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">나를 표현하는 한 마디</label>
        <input
          name="bio"
          type="text"
          defaultValue={profile.bio || ''}
          placeholder="예: 여행을 좋아해요!"
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-5 rounded-3xl bg-zinc-900 text-white text-lg font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all mt-4"
      >
        {loading ? '저장 중...' : '프로필 저장'}
      </button>
    </form>
  )
}
