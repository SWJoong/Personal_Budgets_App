'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/LiveRegion'
import { EmptyState } from '@/components/ui/EmptyState'
import { getDocumentSignedUrl, deleteShelfDocument, uploadShelfDocument } from '@/app/actions/document'
import type { DocumentShelf } from '@/utils/documentShelf'

/** 유형칩 색(색상만으로 의미 전달 금지 — 텍스트 라벨 병기, §5 a11y). */
const TYPE_STYLE: Record<string, string> = {
  신청서: 'bg-info-bg text-info-fg',
  동의서: 'bg-success-bg text-success-fg',
  기타: 'bg-neutral-bg text-neutral-fg',
}

/** 서류 유형 3종(seoul_application_documents.doc_type). 라벨은 documentShelf.documentTypeLabel 과 동일. */
type ShelfDocType = 'application_form' | 'consent_form' | 'other'
const DOC_TYPE_OPTIONS: { value: ShelfDocType; label: string }[] = [
  { value: 'application_form', label: '신청서' },
  { value: 'consent_form', label: '동의서' },
  { value: 'other', label: '기타' },
]

/**
 * 서류 보관함(B2) — 상단 [당사자 선택 업로드](항상 노출) + 당사자별 그룹(펼침) + 문서 [열기]·[삭제].
 * 담당자 화면(표준어). 설계 §1 IA·§2 A3(+★F1 후속).
 *
 * F1: 업로드를 '그룹 안(서류≥1인 당사자만)'에서 → **상단 당사자-선택 업로드**로 통일한다. 서류가 하나도
 *   없어도(빈 셸프) 담당 당사자를 골라 첫 서류를 올릴 수 있다 — 빈 셸프 dead-end 해소.
 * [열기]는 클릭 시 getDocumentSignedUrl 발급(private 버킷·1h 만료, 사전 전량발급 금지).
 * [삭제]·업로드는 deleteShelfDocument·uploadShelfDocument(세션 RLS 인가) 후 router.refresh().
 */
export default function DocumentShelfClient({
  shelf,
  assignableParticipants,
}: {
  shelf: DocumentShelf
  assignableParticipants: { id: string; name: string }[]
}) {
  const { announce } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(null)

  // 상단 업로드 폼 — 그룹 컨텍스트가 아니라 고른 당사자(participantId)를 쓴다(F1).
  const [participantId, setParticipantId] = useState('')
  const [docType, setDocType] = useState<ShelfDocType>('application_form')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleOpen(documentId: string) {
    announce('서류를 열고 있어요.', 'polite')
    startTransition(async () => {
      const result = await getDocumentSignedUrl(documentId)
      if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
        return
      }
      announce(result.error ?? '서류를 열지 못했어요.', 'assertive')
    })
  }

  function handleDelete(documentId: string) {
    if (!window.confirm('이 서류를 삭제할까요?')) return
    announce('서류를 지우고 있어요.', 'polite')
    startTransition(async () => {
      const result = await deleteShelfDocument(documentId)
      if (result.success) {
        announce('서류를 지웠어요.', 'polite')
        router.refresh()
        return
      }
      announce(result.error ?? '서류를 지우지 못했어요.', 'assertive')
    })
  }

  function resetUploadForm() {
    setParticipantId('')
    setDocType('application_form')
    setNote('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!participantId) {
      announce('먼저 당사자를 골라 주세요.', 'assertive')
      return
    }
    if (!file) {
      announce('올릴 파일을 먼저 골라 주세요.', 'assertive')
      return
    }
    const picked = file
    const forParticipant = participantId
    const reader = new FileReader()
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : ''
      // data:...;base64,XXXX → 접두 제거 후 순수 base64 만.
      const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw
      announce('서류를 올리고 있어요.', 'polite')
      startTransition(async () => {
        const result = await uploadShelfDocument({
          participantId: forParticipant,
          docType,
          fileName: picked.name,
          base64,
          mimeType: picked.type,
          note: note.trim() || undefined,
        })
        if (result.success) {
          announce('서류를 올렸어요.', 'polite')
          resetUploadForm()
          router.refresh()
          return
        }
        announce(result.error ?? '서류를 올리지 못했어요.', 'assertive')
      })
    }
    reader.onerror = () => announce('파일을 읽지 못했어요.', 'assertive')
    reader.readAsDataURL(picked)
  }

  const isEmpty = shelf.participants.length === 0

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 당사자-선택 업로드(항상 노출) — 빈 셸프에서도 첫 서류를 올릴 유일 진입점(F1). */}
      <section className="p-4 rounded-2xl bg-card ring-1 ring-border">
        <h2 className="text-sm font-bold text-foreground">서류 올리기</h2>
        <form onSubmit={handleUpload} className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="shelf-participant" className="text-xs text-muted-foreground font-medium">
              당사자
            </label>
            <select
              id="shelf-participant"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="p-3 min-h-[44px] rounded-xl bg-muted ring-1 ring-border text-foreground font-medium"
            >
              <option value="">당사자를 골라 주세요</option>
              {assignableParticipants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="shelf-doctype" className="text-xs text-muted-foreground font-medium">
              서류 종류
            </label>
            <select
              id="shelf-doctype"
              value={docType}
              onChange={(e) => setDocType(e.target.value as ShelfDocType)}
              className="p-3 min-h-[44px] rounded-xl bg-muted ring-1 ring-border text-foreground font-medium"
            >
              {DOC_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="shelf-file" className="text-xs text-muted-foreground font-medium">
              파일 고르기
            </label>
            <input
              id="shelf-file"
              ref={fileInputRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-bold file:text-muted-foreground"
            />
            {file && <span className="text-xs text-muted-foreground">📎 {file.name}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="shelf-note" className="text-xs text-muted-foreground font-medium">
              메모 (안 써도 돼요)
            </label>
            <input
              id="shelf-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="p-3 min-h-[44px] rounded-xl bg-muted ring-1 ring-border text-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="px-4 min-h-[44px] rounded-xl bg-hero text-hero-foreground text-sm font-bold hover:bg-hero-hover disabled:opacity-50"
          >
            올리기
          </button>
        </form>
      </section>

      {isEmpty ? (
        <EmptyState
          title="아직 등록된 서류가 없어요."
          description="위에서 담당 당사자를 골라 첫 서류를 올릴 수 있어요."
        />
      ) : (
        <>
          <section className="p-4 rounded-2xl bg-muted ring-1 ring-border">
            <span className="text-sm font-bold text-muted-foreground">
              전체 {shelf.totalDocuments}건 · 당사자 {shelf.participants.length}명
            </span>
          </section>

          <ul className="flex flex-col gap-2">
            {shelf.participants.map((p) => {
              const isOpen = expanded === p.participantId
              return (
                <li key={p.participantId} className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.participantId)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-2 p-4 min-h-[44px] text-left hover:bg-muted-hover transition-colors"
                  >
                    <span className="font-bold text-foreground truncate">{p.participantName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      서류 {p.count}건{p.latestDate ? ` · 최근 ${p.latestDate.slice(0, 10)}` : ''}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border">
                      <ul>
                        {p.docs.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border first:border-t-0"
                          >
                            <div className="flex flex-col min-w-0 gap-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${TYPE_STYLE[d.docTypeLabel] ?? 'bg-neutral-bg text-neutral-fg'}`}
                                >
                                  {d.docTypeLabel}
                                </span>
                                <span className="text-sm truncate">{d.fileName}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{d.createdAt.slice(0, 10)}</span>
                              {d.note && (
                                <span className="text-xs text-muted-foreground leading-relaxed">{d.note}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleOpen(d.id)}
                                disabled={pending}
                                className="px-3 min-h-[44px] rounded-xl bg-hero text-hero-foreground text-sm font-bold hover:bg-hero-hover disabled:opacity-50"
                              >
                                열기
                              </button>
                              <button
                                onClick={() => handleDelete(d.id)}
                                disabled={pending}
                                className="px-3 min-h-[44px] rounded-xl bg-danger-bg text-danger-fg text-sm font-bold hover:bg-danger-bg-hover disabled:opacity-50"
                              >
                                삭제
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
