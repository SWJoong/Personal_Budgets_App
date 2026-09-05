'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'
import { FormField } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/LiveRegion'

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
  const { announce } = useToast()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setToast(null)

    try {
      const formData = new FormData(e.currentTarget)
      await updateProfile(formData)
      const msg = '저장했어요.'
      setToast({ type: 'success', message: msg })
      announce(msg)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장 실패'
      setToast({ type: 'error', message: msg })
      announce(msg, 'assertive')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {toast && (
        <div className={`p-4 rounded-2xl text-sm font-bold animate-fade-in-up ${
          toast.type === 'success' ? 'bg-success-bg text-success-fg ring-1 ring-success-fg/20' : 'bg-danger-bg text-danger-fg ring-1 ring-danger-fg/20'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-4xl overflow-hidden ring-4 ring-border">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="프로필" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-black text-muted-foreground">{(profile.name || '?')[0]}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-bold">{userEmail}</p>
      </div>

      {/* Name */}
      <FormField id="profile-name" label="이름" required>
        {(field) => (
          <input
            {...field}
            name="name"
            type="text"
            defaultValue={profile.name || ''}
            className="w-full p-4 rounded-2xl bg-card ring-1 ring-border focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
            required
          />
        )}
      </FormField>

      {/* Role */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold text-muted-foreground ml-1 mb-2">역할</legend>
        {isAdminEmail ? (
          <div className="p-4 rounded-2xl bg-danger-bg ring-1 ring-danger-fg/20">
            <input type="hidden" name="role" value="admin" />
            <div className="flex items-center gap-2">
              <span className="text-xl">🔑</span>
              <span className="font-bold text-danger-fg">관리자 (자동 지정)</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex flex-col items-center p-4 rounded-2xl cursor-pointer transition-all ring-2 ${
              profile.role === 'participant' ? 'ring-primary bg-primary/5' : 'ring-border'
            }`}>
              <input type="radio" name="role" value="participant" defaultChecked={profile.role === 'participant'} className="sr-only" />
              <span className="text-2xl mb-1">🙋</span>
              <span className="text-sm font-bold">사용자</span>
            </label>
            <label className={`flex flex-col items-center p-4 rounded-2xl cursor-pointer transition-all ring-2 ${
              profile.role === 'supporter' ? 'ring-primary bg-primary/5' : 'ring-border'
            }`}>
              <input type="radio" name="role" value="supporter" defaultChecked={profile.role === 'supporter'} className="sr-only" />
              <span className="text-2xl mb-1">🤝</span>
              <span className="text-sm font-bold">지원자</span>
            </label>
          </div>
        )}
      </fieldset>

      {/* Bio */}
      <FormField id="profile-bio" label="나를 표현하는 한 마디">
        {(field) => (
          <input
            {...field}
            name="bio"
            type="text"
            defaultValue={profile.bio || ''}
            placeholder="예: 여행을 좋아해요!"
            className="w-full p-4 rounded-2xl bg-card ring-1 ring-border focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
          />
        )}
      </FormField>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-5 rounded-3xl bg-positive text-positive-foreground text-lg font-black shadow-xl active:scale-95 disabled:bg-input transition-all mt-4"
      >
        {loading ? '저장 중...' : '프로필 저장'}
      </button>
    </form>
  )
}
