'use client'

import { useState, useTransition } from 'react'
import { updateUserRole } from '@/app/actions/admin'
import Link from 'next/link'
import type { UserRole } from '@/types/database'

interface Profile {
  id: string
  name: string | null
  role: string
  created_at: string
}

interface AdminSettingsClientProps {
  currentUserId: string
  currentUserEmail: string
  profiles: Profile[]
}

const ROLE_OPTIONS: { value: UserRole; label: string; emoji: string; desc: string }[] = [
  { value: 'admin', label: '관리자', emoji: '🔑', desc: '전체 시스템 관리 권한' },
  { value: 'supporter', label: '지원자', emoji: '🤝', desc: '당사자 지원 및 회계 관리' },
  { value: 'participant', label: '당사자', emoji: '👤', desc: '개인 예산 관리' },
]

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-50 text-red-600 ring-red-200',
  supporter: 'bg-blue-50 text-blue-600 ring-blue-200',
  participant: 'bg-green-50 text-green-600 ring-green-200',
}

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  supporter: '지원자',
  participant: '당사자',
}

export default function AdminSettingsClient({
  currentUserId,
  currentUserEmail,
  profiles,
}: AdminSettingsClientProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    setMessage(null)
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: '역할이 변경되었습니다.' })
        setEditingUserId(null)
      }
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20 animate-fade-in-up">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/admin/participants" className="text-muted-foreground hover:text-foreground transition-colors">←</Link>
          <h1 className="text-xl font-bold tracking-tight">시스템 설정</h1>
        </div>
        <div className="px-3 py-1 bg-red-50 rounded-full text-[10px] font-bold text-red-500 ring-1 ring-red-200">관리자</div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 현재 관리자 정보 */}
        <section className="warm-banner">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">🔑</div>
            <div>
              <p className="text-sm font-bold text-foreground">현재 관리자</p>
              <p className="text-xs text-muted-foreground">{currentUserEmail}</p>
            </div>
          </div>
        </section>

        {/* 알림 메시지 */}
        {message && (
          <div className={`p-4 rounded-2xl text-sm font-medium text-center animate-fade-in-up ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-700 ring-1 ring-green-200' 
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* 역할 안내 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">역할 안내</h2>
          <div className="grid grid-cols-3 gap-3">
            {ROLE_OPTIONS.map((role) => (
              <div key={role.value} className={`p-4 rounded-2xl bg-card ring-1 ring-border text-center`}>
                <span className="text-2xl block mb-2">{role.emoji}</span>
                <p className="text-sm font-bold">{role.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{role.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 사용자 목록 */}
        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">
              사용자 목록 ({profiles.length}명)
            </h2>
          </div>

          {profiles.length === 0 ? (
            <div className="p-8 rounded-2xl bg-muted text-center">
              <span className="text-5xl mb-3 block">👥</span>
              <p className="text-muted-foreground font-medium">등록된 사용자가 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {profiles.map((profile) => {
                const isCurrentUser = profile.id === currentUserId
                const isEditing = editingUserId === profile.id
                const roleColor = ROLE_COLORS[profile.role] || ROLE_COLORS.participant
                const roleLabel = ROLE_LABELS[profile.role] || profile.role

                return (
                  <div
                    key={profile.id}
                    className={`p-5 rounded-2xl bg-card ring-1 ring-border shadow-sm transition-all ${
                      isCurrentUser ? 'ring-primary/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                          {(profile.name || '?')[0]}
                        </div>
                        <div>
                          <p className="font-bold text-foreground flex items-center gap-2">
                            {profile.name || '이름 없음'}
                            {isCurrentUser && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">나</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(profile.created_at).toLocaleDateString('ko-KR')} 가입
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ring-1 ${roleColor}`}>
                          {roleLabel}
                        </span>
                        {!isCurrentUser && (
                          <button
                            onClick={() => setEditingUserId(isEditing ? null : profile.id)}
                            className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="역할 변경"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 역할 변경 UI */}
                    {isEditing && (
                      <div className="mt-4 pt-4 border-t border-border animate-fade-in-up">
                        <p className="text-xs text-muted-foreground font-bold mb-3">역할 선택</p>
                        <div className="flex gap-2">
                          {ROLE_OPTIONS.map((role) => (
                            <button
                              key={role.value}
                              onClick={() => handleRoleChange(profile.id, role.value)}
                              disabled={isPending || profile.role === role.value}
                              className={`flex-1 p-3 rounded-xl text-center transition-all border-2 ${
                                profile.role === role.value
                                  ? 'border-primary bg-primary/5 text-primary font-bold'
                                  : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                              } disabled:opacity-50`}
                            >
                              <span className="text-lg block">{role.emoji}</span>
                              <span className="text-[11px] font-bold block mt-1">{role.label}</span>
                            </button>
                          ))}
                        </div>
                        {isPending && (
                          <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse-gentle">
                            변경 중...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
