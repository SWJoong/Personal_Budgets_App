'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createParticipant } from '@/app/actions/admin'
import type { Profile } from '@/types/database'

export default function NewParticipantPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [supporters, setSupporters] = useState<Profile[]>([])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [supporterId, setSupporterId] = useState('')

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
    if (!name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    if (!email.trim()) {
      setError('이메일을 입력해주세요.')
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
        setError(result.error)
      } else {
        router.push('/admin/participants')
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link href="/admin/participants" className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3">←</Link>
          <h1 className="text-xl font-bold tracking-tight">새 당사자 등록</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">불러오는 중...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/admin/participants" className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3">←</Link>
        <h1 className="text-xl font-bold tracking-tight">새 당사자 등록</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <fieldset className="flex flex-col gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200">
            <legend className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">당사자 정보</legend>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">이름 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="당사자 이름"
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">이메일 *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="participant@example.com"
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
                required
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                당사자가 이 이메일로 구글 로그인하면 자동으로 이 등록 정보와 연결됩니다.
              </p>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">담당 지원자</label>
            <select
              value={supporterId}
              onChange={(e) => setSupporterId(e.target.value)}
              className="p-4 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
            >
              <option value="">미지정</option>
              {supporters.map(s => (
                <option key={s.id} value={s.id}>{s.name || s.id.slice(0, 8)}</option>
              ))}
            </select>
          </fieldset>

          <button
            type="submit"
            disabled={saving || !name.trim() || !email.trim()}
            className="p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg"
          >
            {saving ? '저장하고 있습니다...' : '당사자 등록하기'}
          </button>
        </form>
      </main>
    </div>
  )
}
