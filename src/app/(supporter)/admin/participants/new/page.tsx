'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createParticipant } from '@/app/actions/admin'
import type { Profile } from '@/types/database'
import { FormField } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/LiveRegion'

export default function NewParticipantPage() {
  const supabase = createClient()
  const router = useRouter()
  const { announce } = useToast()
  const fail = (msg: string) => {
    setError(msg)
    announce(msg, 'assertive')
  }

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [supporters, setSupporters] = useState<Profile[]>([])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [supporterId, setSupporterId] = useState('')
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data: supporterProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'supporter')

      setSupporters(supporterProfiles || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameError('')
    setEmailError('')
    if (!name.trim()) {
      setNameError('이름을 입력해주세요.')
      announce('이름을 입력해주세요.', 'assertive')
      return
    }
    if (!email.trim()) {
      setEmailError('이메일을 입력해주세요.')
      announce('이메일을 입력해주세요.', 'assertive')
      return
    }

    setSaving(true)
    setError('')

    try {
      const result = await createParticipant({
        name: name.trim(),
        email: email.trim(),
        supporterId: supporterId || null,
      })

      if (result.error) {
        fail(result.error)
      } else {
        router.push('/admin/participants')
        router.refresh()
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
          <Link href="/admin/participants" className="text-muted-foreground hover:text-foreground transition-colors mr-3">←</Link>
          <h1 className="text-xl font-bold tracking-tight">새 당사자 등록</h1>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground font-medium">불러오는 중...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <Link href="/admin/participants" className="text-muted-foreground hover:text-foreground transition-colors mr-3">←</Link>
        <h1 className="text-xl font-bold tracking-tight">새 당사자 등록</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium">
              {error}
            </div>
          )}

          <fieldset className="flex flex-col gap-4 p-5 rounded-2xl bg-card ring-1 ring-border">
            <legend className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">당사자 정보</legend>

            <FormField id="new-participant-name" label="이름" required error={nameError || undefined}>
              {(field) => (
                <input
                  {...field}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="당사자 이름"
                  className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium"
                  required
                />
              )}
            </FormField>

            <FormField id="new-participant-email" label="이메일" required error={emailError || undefined} help="당사자가 이 이메일로 구글 로그인하면 자동으로 이 등록 정보와 연결됩니다.">
              {(field) => (
                <input
                  {...field}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="participant@example.com"
                  className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium"
                  required
                />
              )}
            </FormField>
          </fieldset>

          <FormField id="new-participant-supporter" label="담당 지원자">
            {(field) => (
              <select
                {...field}
                value={supporterId}
                onChange={(e) => setSupporterId(e.target.value)}
                className="p-4 rounded-xl bg-card ring-1 ring-border text-foreground font-medium"
              >
                <option value="">미지정</option>
                {supporters.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.id.slice(0, 8)}</option>
                ))}
              </select>
            )}
          </FormField>

          <button
            type="submit"
            disabled={saving || !name.trim() || !email.trim()}
            className="p-4 rounded-2xl bg-hero text-hero-foreground font-bold text-base hover:opacity-90 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg"
          >
            {saving ? '저장하고 있습니다...' : '당사자 등록하기'}
          </button>
        </form>
      </main>
    </div>
  )
}
