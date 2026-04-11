'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { EasyTerm } from '@/components/ui/EasyTerm'
import SelfCheckFeedback from '@/components/ui/SelfCheckFeedback'

interface Person {
  id: string
  name: string | null
  avatar_url: string | null
}

interface Props {
  userId: string
  userEmail: string
  userName: string
  userAvatar: string
  supporters: Person[]
  participants: Person[]
}

type Role = 'participant' | 'supporter'
type Step = 'role' | 'profile' | 'complete'

export default function OnboardingClient({ userId, userEmail, userName, userAvatar, supporters, participants }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('role')
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState(userName)
  const [bio, setBio] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(userAvatar)
  const [budgetType, setBudgetType] = useState<'single' | 'multiple'>('single')
  const [selectedSupporter, setSelectedSupporter] = useState<string>('')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRoleSelect = (r: Role) => {
    setRole(r)
    setStep('profile')
  }

  const handleBack = () => {
    if (step === 'profile') {
      setStep('role')
      setRole(null)
    }
  }

  const handleComplete = async () => {
    if (!role || !name.trim()) {
      setError('이름을 입력해 주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role,
          name: name.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarPreview || null,
          onboarding_completed: true,
        })
        .eq('id', userId)

      if (profileError) throw profileError

      // If participant, create participant record
      if (role === 'participant') {
        const { error: partError } = await supabase
          .from('participants')
          .upsert({
            id: userId,
            funding_source_count: budgetType === 'multiple' ? 2 : 1,
            assigned_supporter_id: selectedSupporter || null,
          })

        if (partError) throw partError
      }

      if (role === 'participant') {
        setStep('complete')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
      <div className="w-full max-w-md">

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`w-3 h-3 rounded-full transition-all ${step === 'role' ? 'bg-primary scale-125' : 'bg-primary'}`} />
          <div className={`w-8 h-0.5 ${step === 'profile' ? 'bg-primary' : 'bg-zinc-200'}`} />
          <div className={`w-3 h-3 rounded-full transition-all ${step === 'profile' ? 'bg-primary scale-125' : 'bg-zinc-200'}`} />
        </div>

        {/* Step 1: Role Selection */}
        {step === 'role' && (
          <div className="bg-white rounded-[2rem] p-8 shadow-xl ring-1 ring-zinc-200 animate-fade-in-up">
            <div className="text-center mb-8">
              <span className="text-5xl block mb-4">👋</span>
              <h1 className="text-2xl font-black text-zinc-900 mb-2">반가워요!</h1>
              <p className="text-zinc-500 font-medium">당신은 어떤 사람인가요?</p>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => handleRoleSelect('participant')}
                className="flex items-center gap-5 p-6 rounded-2xl ring-2 ring-zinc-200 hover:ring-primary hover:bg-primary/5 transition-all active:scale-[0.98] text-left group"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                  🙋
                </div>
                <div>
                  <p className="text-lg font-black text-zinc-900">
                    <EasyTerm formal="사용자 (당사자)" easy="나의 예산을 관리하는 사람" />
                  </p>
                  <p className="text-sm text-zinc-500 font-medium mt-1">나의 예산을 직접 관리하고 싶어요</p>
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect('supporter')}
                className="flex items-center gap-5 p-6 rounded-2xl ring-2 ring-zinc-200 hover:ring-primary hover:bg-primary/5 transition-all active:scale-[0.98] text-left group"
              >
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                  🤝
                </div>
                <div>
                  <p className="text-lg font-black text-zinc-900">지원자</p>
                  <p className="text-sm text-zinc-500 font-medium mt-1">당사자의 예산 관리를 지원해요</p>
                </div>
              </button>
            </div>

            <p className="text-center text-xs text-zinc-400 mt-6">
              나중에 더보기 → 계정 관리에서 바꾸 수 있어요.
            </p>
          </div>
        )}

        {/* Step 2: Profile Setup */}
        {step === 'profile' && role && (
          <div className="bg-white rounded-[2rem] p-8 shadow-xl ring-1 ring-zinc-200 animate-fade-in-up">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-600 transition-colors mb-6 min-h-[44px]"
              aria-label="뒤로 가기"
            >
              <span className="text-xl">←</span>
              <span className="text-sm font-bold">뒤로</span>
            </button>

            <div className="text-center mb-8">
              <span className="text-4xl block mb-3">{role === 'participant' ? '🙋' : '🤝'}</span>
              <h2 className="text-xl font-black text-zinc-900">
                {role === 'participant' ? '사용자 프로필 설정' : '지원자 프로필 설정'}
              </h2>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 text-red-600 text-sm font-bold ring-1 ring-red-200 mb-6 animate-fade-in-up">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-6">
              {/* Profile Image */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center text-4xl overflow-hidden ring-4 ring-zinc-200">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <span>📷</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 font-bold">프로필 사진 (스킵 가능)</p>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-zinc-500 ml-1">이름 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력해 주세요"
                  className="w-full p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
                  required
                />
              </div>

              {/* Participant-specific fields */}
              {role === 'participant' && (
                <>
                  {/* Budget Type */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-500 ml-1">
                      <EasyTerm formal="예산 구조" easy="돈의 종류" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBudgetType('single')}
                        className={`p-4 rounded-2xl text-center transition-all ring-2 ${
                          budgetType === 'single'
                            ? 'ring-primary bg-primary/5 text-primary font-black'
                            : 'ring-zinc-200 text-zinc-500 hover:ring-zinc-300'
                        }`}
                      >
                        <span className="text-2xl block mb-1">💰</span>
                        <span className="text-sm font-bold">재원 하나</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBudgetType('multiple')}
                        className={`p-4 rounded-2xl text-center transition-all ring-2 ${
                          budgetType === 'multiple'
                            ? 'ring-primary bg-primary/5 text-primary font-black'
                            : 'ring-zinc-200 text-zinc-500 hover:ring-zinc-300'
                        }`}
                      >
                        <span className="text-2xl block mb-1">💰💰</span>
                        <span className="text-sm font-bold">둘 이상</span>
                      </button>
                    </div>
                  </div>

                  {/* Supporter Selection */}
                  {supporters.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-zinc-500 ml-1">
                        <EasyTerm formal="담당 지원자" easy="나를 도와주는 선생님" />
                      </label>
                      <div className="flex flex-col gap-2">
                        {supporters.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSupporter(s.id === selectedSupporter ? '' : s.id)}
                            className={`flex items-center gap-3 p-4 rounded-2xl transition-all ring-2 text-left ${
                              selectedSupporter === s.id
                                ? 'ring-primary bg-primary/5'
                                : 'ring-zinc-200 hover:ring-zinc-300'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-lg overflow-hidden">
                              {s.avatar_url ? (
                                <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{(s.name || '?')[0]}</span>
                              )}
                            </div>
                            <span className="font-bold text-zinc-800">{s.name || '이름 없음'}</span>
                            {selectedSupporter === s.id && <span className="ml-auto text-primary text-xl">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Supporter-specific: participant selection */}
              {role === 'supporter' && participants.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-zinc-500 ml-1">담당 당사자 (여러 명 선택 가능)</label>
                  <div className="flex flex-col gap-2">
                    {participants.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleParticipant(p.id)}
                        className={`flex items-center gap-3 p-4 rounded-2xl transition-all ring-2 text-left ${
                          selectedParticipants.includes(p.id)
                            ? 'ring-primary bg-primary/5'
                            : 'ring-zinc-200 hover:ring-zinc-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-lg overflow-hidden">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{(p.name || '?')[0]}</span>
                          )}
                        </div>
                        <span className="font-bold text-zinc-800">{p.name || '이름 없음'}</span>
                        {selectedParticipants.includes(p.id) && <span className="ml-auto text-primary text-xl">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bio */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-zinc-500 ml-1">나를 표현하는 한 마디 (선택)</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="예: 여행을 좋아해요!"
                  className="w-full p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-medium transition-all"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleComplete}
                disabled={loading || !name.trim()}
                className="w-full py-5 rounded-3xl bg-zinc-900 text-white text-xl font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all mt-2"
              >
                {loading ? '설정 중...' : '시작하기 🎉'}
              </button>
            </div>
          </div>
        )}

        {/* 3. Complete Step (SelfCheckFeedback) */}
        {step === 'complete' && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl ring-1 ring-zinc-200 fade-in flex flex-col items-center gap-6">
            <h2 className="text-2xl font-black text-center text-zinc-900">
              준비가 모두 끝났어요!
            </h2>
            <SelfCheckFeedback
              question="앱 시작하기 설정이 쉬웠나요?"
              onComplete={() => {
                router.push('/')
                router.refresh()
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
