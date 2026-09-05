'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createApplication, recordBenefitStatus, type PublicAssistance } from '@/app/actions/application'
import { FormField } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/LiveRegion'

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
  const { announce } = useToast()
  const fail = (msg: string) => {
    setError(msg)
    announce(msg, 'assertive')
  }

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [participants, setParticipants] = useState<ParticipantOption[]>([])
  const [cohorts, setCohorts] = useState<CohortOption[]>([])

  const [participantId, setParticipantId] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [participantError, setParticipantError] = useState('')
  const [cohortError, setCohortError] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  // 신청서 §신청자 정보의 "공공부조 수급현황". 본인부담금 면제 판정의 유일한 입력이라
  // 접수 시점에 받아 둔다 — 심의 승인 때 배정이 만들어지면서 면제 여부가 확정된다.
  const [publicAssistance, setPublicAssistance] = useState<PublicAssistance | ''>('')
  const [usesActivitySupport, setUsesActivitySupport] = useState(false)
  const [participatesInMohwPilot, setParticipatesInMohwPilot] = useState(false)

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
    setParticipantError('')
    setCohortError('')
    if (!participantId) {
      setParticipantError('당사자를 선택해주세요.')
      announce('당사자를 선택해주세요.', 'assertive')
      return
    }
    if (!cohortId) {
      setCohortError('차수를 선택해주세요.')
      announce('차수를 선택해주세요.', 'assertive')
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
        fail(result.error)
        return
      }

      // 수급현황은 신청서와 별개 표(seoul_benefit_status)라 따로 저장한다.
      // 여기서 실패해도 신청서 자체는 이미 접수됐으므로 되돌리지 않고 알리기만 한다 —
      // 접수를 통째로 무르는 것보다 "수급현황만 다시 입력"이 실무자에게 덜 파괴적이다.
      if (publicAssistance) {
        const benefitResult = await recordBenefitStatus({
          participantId,
          publicAssistance,
          usesActivitySupport,
          participatesInMohwPilot,
        })
        if (benefitResult.error) {
          fail(`신청서는 접수됐지만 수급현황 저장에 실패했어요: ${benefitResult.error}`)
          return
        }
      }

      router.push(`/supporter/applications/${result.applicationId}`)
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
          <Link href="/supporter/applications" aria-label="뒤로 가기" className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
          <h1 className="text-xl font-bold tracking-tight">신청서 접수</h1>
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
        <Link href="/supporter/applications" aria-label="뒤로 가기" className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center">←</Link>
        <h1 className="text-xl font-bold tracking-tight">신청서 접수</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium">
              {error}
            </div>
          )}

          <fieldset className="flex flex-col gap-4 p-5 rounded-2xl bg-card ring-1 ring-border">
            <legend className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">신청 정보</legend>

            <FormField
              id="app-participant"
              label="당사자"
              required
              error={participantError || undefined}
              help={participants.length === 0 ? '등록된 당사자가 없어요. 먼저 당사자 관리에서 등록해주세요.' : undefined}
            >
              {(field) => (
                <select
                  {...field}
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium"
                  required
                >
                  <option value="">선택해주세요</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="app-cohort" label="차수" required error={cohortError || undefined}>
              {(field) => (
                <select
                  {...field}
                  value={cohortId}
                  onChange={(e) => setCohortId(e.target.value)}
                  className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium"
                  required
                >
                  <option value="">선택해주세요</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="app-receipt" label="접수번호">
              {(field) => (
                <input
                  {...field}
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="선택 입력"
                  className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium"
                />
              )}
            </FormField>
          </fieldset>

          <fieldset className="flex flex-col gap-4 p-5 rounded-2xl bg-card ring-1 ring-border">
            <legend className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">수급 현황</legend>

            <FormField
              id="app-public-assistance"
              label="공공부조 수급현황"
              help="기초생활수급·차상위는 본인부담금이 면제됩니다. 비워 두면 예산 승인 시 '확인 전'으로 남고, 당사자 화면에도 그렇게 표시됩니다."
            >
              {(field) => (
                <select
                  {...field}
                  value={publicAssistance}
                  onChange={(e) => setPublicAssistance(e.target.value as PublicAssistance | '')}
                  className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium"
                >
                  <option value="">아직 확인 못함</option>
                  <option value="basic_livelihood">기초생활수급</option>
                  <option value="near_poor">차상위(조건부수급)</option>
                  <option value="none">해당없음</option>
                </select>
              )}
            </FormField>

            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={usesActivitySupport}
                onChange={(e) => setUsesActivitySupport(e.target.checked)}
                className="w-5 h-5 rounded accent-foreground"
              />
              <span className="text-sm text-muted-foreground font-medium">장애인 활동지원서비스 이용 중</span>
            </label>

            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={participatesInMohwPilot}
                onChange={(e) => setParticipatesInMohwPilot(e.target.checked)}
                className="w-5 h-5 rounded accent-foreground"
              />
              <span className="text-sm text-muted-foreground font-medium">보건복지부 개인예산제 시범사업 참여 중</span>
            </label>
            {participatesInMohwPilot && (
              <p className="text-[11px] text-warning-fg bg-warning-bg rounded-lg p-3 leading-relaxed">
                복지부 시범사업 참여자는 서울형에 참여할 수 없습니다. 이대로 저장하면
                선정 단계에서 막힙니다.
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={saving || !participantId || !cohortId}
            className="p-4 rounded-2xl bg-hero text-hero-foreground font-bold text-base hover:bg-hero-hover transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg min-h-[44px]"
          >
            {saving ? '저장하고 있습니다...' : '신청서 접수하기'}
          </button>
        </form>
      </main>
    </div>
  )
}
