'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createApplication } from '@/app/actions/application'

interface ParticipantOption {
  id: string
  name: string
}

interface CohortOption {
  id: string
  name: string
  code: string
}

export default function NewApplicationPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [participants, setParticipants] = useState<ParticipantOption[]>([])
  const [cohorts, setCohorts] = useState<CohortOption[]>([])

  const [participantId, setParticipantId] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: participantRows }, { data: cohortRows }] = await Promise.all([
        supabase.from('participants').select('id, name').order('name'),
        supabase.from('seoul_cohorts').select('id, name, code').eq('is_active', true).order('code', { ascending: false }),
      ])
      setParticipants(participantRows ?? [])
      setCohorts(cohortRows ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!participantId) {
      setError('당사자를 선택해주세요.')
      return
    }
    if (!cohortId) {
      setError('차수를 선택해주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const result = await createApplication({
        participantId,
        cohortId,
        receiptNumber: receiptNumber.trim() || undefined,
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/supporter/applications/${result.applicationId}`)
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
          <Link href="/supporter/applications" aria-label="뒤로 가기" className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
          <h1 className="text-xl font-bold tracking-tight">신청서 접수</h1>
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
        <Link href="/supporter/applications" aria-label="뒤로 가기" className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
        <h1 className="text-xl font-bold tracking-tight">신청서 접수</h1>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <fieldset className="flex flex-col gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200">
            <legend className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">신청 정보</legend>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">당사자 *</label>
              <select
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
                required
              >
                <option value="">선택해주세요</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {participants.length === 0 && (
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                  등록된 당사자가 없어요. 먼저 당사자 관리에서 등록해주세요.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">차수 *</label>
              <select
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
                required
              >
                <option value="">선택해주세요</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">접수번호</label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="선택 입력"
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={saving || !participantId || !cohortId}
            className="p-4 rounded-2xl bg-zinc-900 text-white font-bold text-base hover:bg-zinc-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg min-h-[44px]"
          >
            {saving ? '저장하고 있습니다...' : '신청서 접수하기'}
          </button>
        </form>
      </main>
    </div>
  )
}
