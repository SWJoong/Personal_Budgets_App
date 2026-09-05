'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createNeedsAssessment, deleteNeedsAssessment } from '@/app/actions/needsAssessment'

type Program = 'seoul' | 'mohw'

interface Domain {
  id: string
  program: string
  code: string
  label: string
  sort_order: number
}

interface Subdomain {
  id: string
  domain_id: string
  code: string
  label: string
  sort_order: number
}

interface Assessment {
  id: string
  program: string
  domain_id: string
  subdomain_id: string | null
  support_example: string | null
  limitation: string | null
  need_hope: string | null
  created_at: string
}

const PROGRAM_LABEL: Record<Program, string> = { seoul: '서울형', mohw: '보건복지부' }

const inputClass =
  'p-3 rounded-xl bg-muted ring-1 ring-border text-foreground leading-relaxed focus:ring-foreground focus:outline-none'

export default function AssessmentClient({
  participantId,
  assessments,
  domains,
  subdomains,
}: {
  participantId: string
  assessments: Assessment[]
  domains: Domain[]
  subdomains: Subdomain[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [program, setProgram] = useState<Program>('seoul')
  const [domainId, setDomainId] = useState('')
  const [subdomainId, setSubdomainId] = useState('')
  const [limitation, setLimitation] = useState('')
  const [needHope, setNeedHope] = useState('')
  const [supportExample, setSupportExample] = useState('')

  const domainLabelById = new Map(domains.map((d) => [d.id, d.label]))
  const subdomainLabelById = new Map(subdomains.map((s) => [s.id, s.label]))

  const domainsForProgram = domains.filter((d) => d.program === program)
  const subdomainsForDomain = subdomains.filter((s) => s.domain_id === domainId)
  const hasSubdomains = program === 'mohw' && subdomainsForDomain.length > 0

  function selectProgram(p: Program) {
    setProgram(p)
    setDomainId('')
    setSubdomainId('')
  }

  function selectDomain(id: string) {
    setDomainId(id)
    setSubdomainId('')
  }

  function handleCreate() {
    if (!domainId) {
      setError('지원 영역을 골라 주세요.')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await createNeedsAssessment({
        participantId,
        program,
        domainId,
        subdomainId: program === 'mohw' ? subdomainId || null : null,
        limitation: limitation.trim() || undefined,
        needHope: needHope.trim() || undefined,
        supportExample: supportExample.trim() || undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setDomainId('')
      setSubdomainId('')
      setLimitation('')
      setNeedHope('')
      setSupportExample('')
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    setError('')
    startTransition(async () => {
      const result = await deleteNeedsAssessment(id)
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium">{error}</div>
      )}

      {/* 지금까지 적은 욕구 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-muted-foreground">지금까지 적은 욕구</h2>
        {assessments.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center leading-relaxed">
            아직 적은 욕구가 없어요.
            <br />
            아래에서 도움이 필요한 영역을 골라 적어 주세요.
          </p>
        ) : (
          assessments.map((a) => (
            <div key={a.id} className="p-4 rounded-2xl bg-muted ring-1 ring-border flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-border text-muted-foreground shrink-0">
                    {PROGRAM_LABEL[a.program as Program] ?? a.program}
                  </span>
                  <span className="text-sm font-bold text-foreground truncate">
                    {domainLabelById.get(a.domain_id) ?? '지원 영역'}
                    {a.subdomain_id && subdomainLabelById.get(a.subdomain_id)
                      ? ` · ${subdomainLabelById.get(a.subdomain_id)}`
                      : ''}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={pending}
                  aria-label={`${domainLabelById.get(a.domain_id) ?? '이 항목'} 욕구 지우기`}
                  className="text-muted-foreground hover:text-danger-fg transition-colors text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-end disabled:opacity-50"
                >
                  지우기
                </button>
              </div>
              {a.limitation && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="text-muted-foreground">어려운 점: </span>
                  {a.limitation}
                </p>
              )}
              {a.need_hope && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="text-muted-foreground">바라는 것: </span>
                  {a.need_hope}
                </p>
              )}
              {a.support_example && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="text-muted-foreground">도움이 될 것: </span>
                  {a.support_example}
                </p>
              )}
            </div>
          ))
        )}
      </section>

      {/* 새 욕구 적기 */}
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-sm font-bold text-muted-foreground">새 욕구 적기</h2>

        {/* 제도 토글 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">제도</span>
          <div className="flex gap-2" role="group" aria-label="제도 선택">
            {(['seoul', 'mohw'] as Program[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => selectProgram(p)}
                aria-pressed={program === p}
                className={`flex-1 p-3 rounded-xl font-bold text-sm transition-colors min-h-[44px] ${
                  program === p
                    ? 'bg-hero text-hero-foreground'
                    : 'bg-muted ring-1 ring-border text-muted-foreground hover:ring-foreground'
                }`}
              >
                {PROGRAM_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        {/* 대분류 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="assessment-domain" className="text-xs text-muted-foreground font-medium">
            도움이 필요한 영역 *
          </label>
          <select
            id="assessment-domain"
            value={domainId}
            onChange={(e) => selectDomain(e.target.value)}
            className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium focus:ring-foreground focus:outline-none"
          >
            <option value="">골라 주세요</option>
            {domainsForProgram.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* 중분류 — 복지부 + 해당 대분류에 중분류가 있을 때만 */}
        {hasSubdomains && (
          <div className="flex flex-col gap-1">
            <label htmlFor="assessment-subdomain" className="text-xs text-muted-foreground font-medium">
              세부 영역 (중분류)
            </label>
            <select
              id="assessment-subdomain"
              value={subdomainId}
              onChange={(e) => setSubdomainId(e.target.value)}
              className="p-3 rounded-xl bg-muted ring-1 ring-border text-foreground font-medium focus:ring-foreground focus:outline-none"
            >
              <option value="">세부 영역 안 고름</option>
              {subdomainsForDomain.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="assessment-limitation" className="text-xs text-muted-foreground font-medium">
            어떤 점이 어려운가요?
          </label>
          <textarea
            id="assessment-limitation"
            value={limitation}
            onChange={(e) => setLimitation(e.target.value)}
            rows={2}
            placeholder="예: 혼자 버스를 타기 어려워요"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="assessment-need" className="text-xs text-muted-foreground font-medium">
            무엇을 바라나요?
          </label>
          <textarea
            id="assessment-need"
            value={needHope}
            onChange={(e) => setNeedHope(e.target.value)}
            rows={2}
            placeholder="예: 혼자 외출하고 싶어요"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="assessment-example" className="text-xs text-muted-foreground font-medium">
            도움이 될 만한 것 (안 적어도 돼요)
          </label>
          <input
            id="assessment-example"
            value={supportExample}
            onChange={(e) => setSupportExample(e.target.value)}
            placeholder="예: 이동 지원 서비스"
            className={inputClass}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={pending || !domainId}
          className="p-4 rounded-2xl bg-hero text-hero-foreground font-bold text-base hover:opacity-90 transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
        >
          {pending ? '저장하고 있어요...' : '욕구 추가하기'}
        </button>
      </section>
    </div>
  )
}
