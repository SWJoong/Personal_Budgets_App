'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

interface Participant {
  id: string
  name: string
}

interface PreviewBannerProps {
  currentParticipant: Participant
  allParticipants: Participant[]
  onEditModeToggle?: (isEditMode: boolean) => void
}

export default function PreviewBanner({ currentParticipant, allParticipants, onEditModeToggle }: PreviewBannerProps) {
  const router = useRouter()
  const [isEditMode, setIsEditMode] = useState(false)

  const handleEditToggle = () => {
    const newMode = !isEditMode
    setIsEditMode(newMode)
    if (onEditModeToggle) {
      onEditModeToggle(newMode)
    }
  }

  return (
    <div
      role="region"
      aria-label="미리보기 모드 안내"
      className={`sticky top-0 z-50 shadow-md transition-colors ${
        isEditMode
          ? 'bg-info-solid text-info-solid-foreground border-b-2 border-info-solid-foreground/60'
          : 'bg-warning text-warning-foreground border-b-2 border-warning-foreground'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-base">{isEditMode ? '✏️' : '👁'}</span>
          <span aria-live="polite" className="text-sm font-black">
            {isEditMode ? '편집 모드' : '미리보기 모드'}
          </span>
          <span aria-hidden="true" className={`${isEditMode ? 'text-info-solid-foreground/70' : 'text-warning-foreground/70'} text-sm`}>·</span>
          <select
            value={currentParticipant.id}
            onChange={(e) => router.push(`/admin/participants/${e.target.value}/preview`)}
            aria-label="미리보기할 당사자 선택"
            className={`text-sm font-bold border rounded-lg px-2 min-h-[44px] cursor-pointer focus-visible:ring-2 ${
              isEditMode
                ? 'bg-transparent text-info-solid-foreground border-info-solid-foreground/70 focus-visible:ring-info-solid-foreground'
                : 'bg-transparent text-warning-foreground border-warning-foreground/60 focus-visible:ring-warning-foreground'
            }`}
          >
            {allParticipants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEditToggle}
            className={`flex items-center justify-center gap-1 text-xs font-bold px-3 min-h-[44px] rounded-lg transition-colors ${
              isEditMode
                ? 'bg-info-solid-foreground text-info-solid hover:bg-info-solid-foreground/90'
                : 'bg-warning-foreground text-warning hover:bg-warning-foreground/90 border border-warning-foreground'
            }`}
          >
            <span aria-hidden="true">{isEditMode ? '👁' : '✏️'}</span>
            <span>{isEditMode ? '보기 모드' : '편집 모드'}</span>
          </button>
          <Link
            href={`/admin/participants/${currentParticipant.id}`}
            aria-label="미리보기 닫기"
            className={`flex items-center justify-center gap-1 text-sm font-bold px-3 min-h-[44px] min-w-[44px] rounded-lg transition-colors border ${
              isEditMode
                ? 'text-info-solid-foreground bg-transparent border-info-solid-foreground/70 hover:brightness-95'
                : 'text-warning-foreground bg-transparent border-warning-foreground/60 hover:bg-warning-foreground/10'
            }`}
          >
            <span aria-hidden="true">✕</span>
            <span>닫기</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
