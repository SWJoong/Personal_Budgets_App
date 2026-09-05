'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/ui/LiveRegion'
import { getDocumentSignedUrl } from '@/app/actions/document'
import type { DocumentShelf } from '@/utils/documentShelf'

/** 유형칩 색(색상만으로 의미 전달 금지 — 텍스트 라벨 병기, §5 a11y). */
const TYPE_STYLE: Record<string, string> = {
  신청서: 'bg-info-bg text-info-fg',
  동의서: 'bg-success-bg text-success-fg',
  기타: 'bg-neutral-bg text-neutral-fg',
}

/**
 * 서류 보관함(B2) — 당사자별 그룹(펼침) + 문서 [열기]. 담당자 화면(표준어). 설계 §1 IA.
 * [열기]는 클릭 시 getDocumentSignedUrl 발급(private 버킷·1h 만료, 사전 전량발급 금지).
 */
export default function DocumentShelfClient({ shelf }: { shelf: DocumentShelf }) {
  const { announce } = useToast()
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(null)

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

  if (shelf.participants.length === 0) {
    return <p className="text-sm text-muted-foreground leading-relaxed py-12 text-center">아직 등록된 서류가 없어요.</p>
  }

  return (
    <div className="flex flex-col gap-4">
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
                className="w-full flex items-center justify-between gap-2 p-4 min-h-[44px] text-left hover:bg-muted transition-colors"
              >
                <span className="font-bold text-foreground truncate">{p.participantName}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  서류 {p.count}건{p.latestDate ? ` · 최근 ${p.latestDate.slice(0, 10)}` : ''}
                </span>
              </button>

              {isOpen && (
                <ul className="border-t border-border">
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
                        {d.note && <span className="text-xs text-muted-foreground leading-relaxed">{d.note}</span>}
                      </div>
                      <button
                        onClick={() => handleOpen(d.id)}
                        disabled={pending}
                        className="shrink-0 px-3 min-h-[44px] rounded-xl bg-hero text-hero-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
                      >
                        열기
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
