'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createParticipant } from '@/app/actions/admin'
import type { Profile } from '@/types/database'

interface FundingSourceInput {
  name: string
  monthly_budget: string
  yearly_budget: string
}

export default function NewParticipantPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 지원자 목록만 로드 (당사자는 UUID로 직접 생성)
  const [supporters, setSupporters] = useState<Profile[]>([])

  // 폼 데이터
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [monthlyBudget, setMonthlyBudget] = useState('150000')
  const [yearlyBudget, setYearlyBudget] = useState('1500000')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-12-31')
  const [alertThreshold, setAlertThreshold] = useState('15000')
  const [supporterId, setSupporterId] = useState('')
  const [fundingSourceCount, setFundingSourceCount] = useState(1)
  const [fundingSources, setFundingSources] = useState<FundingSourceInput[]>([
    { name: '주 재원 (개인예산)', monthly_budget: '150000', yearly_budget: '1500000' }
  ])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // 지원자 목록만 로드
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

  function handleFundingSourceCountChange(count: number) {
    setFundingSourceCount(count)
    const newSources = [...fundingSources]
    while (newSources.length < count) {
      newSources.push({ name: `재원 ${newSources.length + 1}`, monthly_budget: '0', yearly_budget: '0' })
    }
    while (newSources.length > count) {
      newSources.pop()
    }
    setFundingSources(newSources)
  }

  function updateFundingSource(index: number, field: keyof FundingSourceInput, value: string) {
    const updated = [...fundingSources]
    updated[index] = { ...updated[index], [field]: value }
    setFundingSources(updated)
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
        monthlyBudget: Number(monthlyBudget),
        yearlyBudget: Number(yearlyBudget),
        startDate,
        endDate,
        alertThreshold: Number(alertThreshold),
        supporterId: supporterId || null,
        fundingSources: fundingSources.map(fs => ({
          name: fs.name,
          monthlyBudget: Number(fs.monthly_budget),
          yearlyBudget: Number(fs.yearly_budget),
        })),
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/admin/participants')
        router.refresh()
      }
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다.')
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

          {/* 당사자 정보 */}
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
            </div>
          </fieldset>

          {/* 예산 설정 */}
          <fieldset className="flex flex-col gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200">
            <legend className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">예산 설정</legend>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-medium">월 예산 (원)</label>
                <input
                  type="number"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 font-bold text-zinc-800 focus:ring-zinc-400 focus:outline-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-medium">연 예산 (원)</label>
                <input
                  type="number"
                  value={yearlyBudget}
                  onChange={(e) => setYearlyBudget(e.target.value)}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 font-bold text-zinc-800 focus:ring-zinc-400 focus:outline-none"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-medium">운영 시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 focus:ring-zinc-400 focus:outline-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-medium">운영 종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 focus:ring-zinc-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">경고 기준액 (원)</label>
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 font-bold text-zinc-800 focus:ring-zinc-400 focus:outline-none"
                required
              />
            </div>
          </fieldset>

          {/* 담당 지원자 */}
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

          {/* 재원 설정 */}
          <fieldset className="flex flex-col gap-4 p-5 rounded-2xl bg-white ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <legend className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">재원 설정</legend>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFundingSourceCountChange(Math.max(1, fundingSourceCount - 1))}
                  className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 font-bold hover:bg-zinc-200 transition-colors"
                >−</button>
                <span className="text-sm font-bold text-zinc-700 w-6 text-center">{fundingSourceCount}</span>
                <button
                  type="button"
                  onClick={() => handleFundingSourceCountChange(Math.min(5, fundingSourceCount + 1))}
                  className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 font-bold hover:bg-zinc-200 transition-colors"
                >+</button>
              </div>
            </div>

            {fundingSources.map((fs, i) => (
              <div key={i} className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                <div className="text-xs font-bold text-zinc-500">재원 {i + 1}</div>
                <input
                  type="text"
                  value={fs.name}
                  onChange={(e) => updateFundingSource(i, 'name', e.target.value)}
                  placeholder="재원 이름"
                  className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-zinc-800 font-medium focus:ring-zinc-400 focus:outline-none"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-400 font-medium">월 예산</label>
                    <input
                      type="number"
                      value={fs.monthly_budget}
                      onChange={(e) => updateFundingSource(i, 'monthly_budget', e.target.value)}
                      className="p-2.5 rounded-lg bg-white ring-1 ring-zinc-200 text-sm font-bold text-zinc-800 focus:ring-zinc-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-400 font-medium">연 예산</label>
                    <input
                      type="number"
                      value={fs.yearly_budget}
                      onChange={(e) => updateFundingSource(i, 'yearly_budget', e.target.value)}
                      className="p-2.5 rounded-lg bg-white ring-1 ring-zinc-200 text-sm font-bold text-zinc-800 focus:ring-zinc-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </fieldset>

          {/* 제출 버튼 */}
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
