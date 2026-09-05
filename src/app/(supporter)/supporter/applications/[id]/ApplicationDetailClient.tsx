'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  recordConsent,
  updateApplicationStatus,
  uploadApplicationDocument,
  getApplicationDocumentUrl,
  type ApplicationStatus,
  type ApplicationDocType,
  type ApplicationDocumentRow,
} from '@/app/actions/application'
import { decideSelection } from '@/app/actions/selection'

interface ConsentRecord {
  id: string
  consent_type: 'general' | 'unique_id'
  is_agreed: boolean
  withdrawn_at: string | null
}

interface SelectionDecision {
  is_selected: boolean
  selection_reason: string | null
}

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: '작성 중',
  received: '접수됨',
  screening: '심사 중',
  selected: '선정됨',
  not_selected: '선정 안 됨',
  withdrawn: '철회됨',
}

const CONSENT_LABEL: Record<'general' | 'unique_id', string> = {
  general: '개인정보 수집·이용 동의',
  unique_id: '고유식별정보(주민등록번호 등) 처리 동의',
}

const DOC_TYPE_LABEL: Record<string, string> = {
  application_form: '신청서 원본',
  consent_form: '동의서 원본',
  other: '기타 서류',
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ApplicationDetailClient({
  applicationId,
  participantId,
  participantName,
  cohortName,
  status,
  isAdmin,
  initialConsents,
  initialDecision,
  documents,
  participatesInMohwPilot,
}: {
  applicationId: string
  participantId: string
  participantName: string
  cohortName: string
  status: string
  isAdmin: boolean
  initialConsents: ConsentRecord[]
  initialDecision: SelectionDecision | null
  documents: ApplicationDocumentRow[]
  participatesInMohwPilot: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [docType, setDocType] = useState<ApplicationDocType>('application_form')

  /** 원본 서식을 그대로 보관한다 — 서식 문항을 앱에 옮겨 담지 않는다 */
  function handleUploadDocument(file: File) {
    setError('')
    startTransition(async () => {
      const base64 = await fileToBase64(file)
      const result = await uploadApplicationDocument({
        applicationId,
        participantId,
        docType,
        fileName: file.name,
        base64,
        mimeType: file.type || undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  /** documents 버킷은 private 이라 열람할 때마다 signed URL 을 새로 받는다 */
  function handleOpenDocument(documentId: string) {
    setError('')
    startTransition(async () => {
      const result = await getApplicationDocumentUrl(documentId)
      if (result.error || !result.url) {
        setError(result.error ?? '서류를 열 수 없어요.')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    })
  }

  const [agreed, setAgreed] = useState<Record<'general' | 'unique_id', boolean>>({
    general: initialConsents.find((c) => c.consent_type === 'general' && !c.withdrawn_at)?.is_agreed ?? false,
    unique_id: initialConsents.find((c) => c.consent_type === 'unique_id' && !c.withdrawn_at)?.is_agreed ?? false,
  })

  const [reason, setReason] = useState('')

  function handleSaveConsents() {
    setError('')
    startTransition(async () => {
      for (const consentType of ['general', 'unique_id'] as const) {
        const result = await recordConsent({
          applicationId,
          participantId,
          consentType,
          isAgreed: agreed[consentType],
        })
        if (result.error) {
          setError(result.error)
          return
        }
      }
      router.refresh()
    })
  }

  function handleDecide(isSelected: boolean) {
    if (!isSelected && !reason.trim()) {
      setError('선정하지 않는 경우 사유를 입력해주세요.')
      return
    }
    if (!isSelected && !window.confirm('정말 선정하지 않음으로 결정할까요? 결정 뒤에는 스스로 바꿀 수 없어요.')) {
      return
    }
    setError('')
    startTransition(async () => {
      const result = await decideSelection({ applicationId, isSelected, selectionReason: reason.trim() || undefined })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleWithdraw() {
    if (!window.confirm('정말 이 신청을 철회 처리할까요?')) return
    setError('')
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, 'withdrawn')
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
        <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium leading-relaxed">
          {error}
        </div>
      )}

      <section className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-1">
        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">신청 정보</span>
        <span className="text-lg font-bold">{participantName}</span>
        <span className="text-sm text-muted-foreground">{cohortName}</span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral-bg text-neutral-fg w-fit mt-2">
          {STATUS_LABEL[status as ApplicationStatus] ?? status}
        </span>
      </section>

      <section className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-4">
        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">동의 확인</span>
        {(['general', 'unique_id'] as const).map((type) => (
          <label key={type} className="flex items-center gap-3 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={agreed[type]}
              onChange={(e) => setAgreed((prev) => ({ ...prev, [type]: e.target.checked }))}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium text-muted-foreground">{CONSENT_LABEL[type]}</span>
          </label>
        ))}
        <button
          onClick={handleSaveConsents}
          disabled={pending}
          className="p-3 rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:opacity-90 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          동의 내용 저장
        </button>
      </section>

      {isAdmin && (
        <section className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-4">
          <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">선정 결정</span>
          {initialDecision ? (
            <div className="flex flex-col gap-1">
              <span className={`font-bold ${initialDecision.is_selected ? 'text-success-fg' : 'text-danger-fg'}`}>
                {initialDecision.is_selected ? '선정됨' : '선정 안 됨'}
              </span>
              {initialDecision.selection_reason && (
                <p className="text-sm text-muted-foreground leading-relaxed">{initialDecision.selection_reason}</p>
              )}
            </div>
          ) : (
            <>
              {/* 복지부 시범사업 중복은 앱이 막지 않는다 — 확인은 수행기관이 한다(기관 확인).
                  다만 놓치면 안 되는 자격 요건이라 선정 화면에서 눈에 띄게 알린다. */}
              {participatesInMohwPilot && (
                <div className="p-4 rounded-xl bg-warning-bg border border-border text-warning-fg text-sm leading-relaxed">
                  ⚠️ 이 신청자는 <b>보건복지부 개인예산제 시범사업 참여</b>로 기록돼 있어요.
                  안내문상 중복 참여는 불가하니, 수행기관에서 확인한 뒤 선정해 주세요.
                </div>
              )}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="사유 (선정하지 않을 때는 필수예요)"
                rows={3}
                className="p-3 rounded-xl bg-muted ring-1 ring-border text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecide(true)}
                  disabled={pending}
                  className="flex-1 p-3 rounded-xl bg-positive text-positive-foreground font-bold text-sm hover:opacity-90 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  선정
                </button>
                <button
                  onClick={() => handleDecide(false)}
                  disabled={pending}
                  className="flex-1 p-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm hover:opacity-90 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  선정 안 함
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* 신청서·동의서 원본 보관.
          서식의 문항을 앱에 옮겨 담지 않는다 — 법정 서식은 임의로 바꿀 수 없고
          차수마다 달라지므로 원본 파일을 그대로 두는 편이 정확하다(기관 확인). */}
      <section className="p-5 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-3">
        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">서식 원본 보관</span>

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">아직 보관된 원본이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-muted-foreground">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</span>
                  <span className="text-sm text-muted-foreground truncate">{d.file_name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenDocument(d.id)}
                  disabled={pending}
                  className="shrink-0 px-3 py-2 rounded-lg bg-hero text-hero-foreground text-xs font-bold disabled:opacity-50 min-h-[36px]"
                >
                  열기
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as ApplicationDocType)}
            className="p-2 rounded-lg bg-muted ring-1 ring-border text-sm"
          >
            <option value="application_form">신청서 원본</option>
            <option value="consent_form">동의서 원본</option>
            <option value="other">기타 서류</option>
          </select>
          <input
            type="file"
            accept=".pdf,.hwp,.docx,image/*"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUploadDocument(file)
              e.target.value = ''
            }}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            원본은 비공개 보관함에 저장되며, 열람할 때마다 1시간짜리 임시 링크가 발급됩니다.
          </p>
        </div>
      </section>

      {status !== 'withdrawn' && status !== 'selected' && status !== 'not_selected' && (
        <button
          onClick={handleWithdraw}
          disabled={pending}
          className="p-3 rounded-xl bg-danger-bg text-danger-fg font-bold text-sm hover:opacity-90 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          신청 철회 처리
        </button>
      )}
    </div>
  )
}
