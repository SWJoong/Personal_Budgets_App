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
        isEditMode ? 'bg-blue-500 text-white' : 'bg-amber-400 text-amber-900'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-base">{isEditMode ? '✏️' : '👁'}</span>
          <span aria-live="polite" className="text-sm font-black">
            {isEditMode ? '편집 모드' : '미리보기 모드'}
          </span>
          <span aria-hidden="true" className={`${isEditMode ? 'text-blue-200' : 'text-amber-700'} text-sm`}>·</span>
          <select
            value={currentParticipant.id}
            onChange={(e) => router.push(`/admin/participants/${e.target.value}/preview`)}
            aria-label="미리보기할 당사자 선택"
            className={`text-sm font-bold border rounded-lg px-2 min-h-[44px] cursor-pointer focus:outline-none focus:ring-2 ${
              isEditMode
                ? 'bg-blue-400 text-white border-blue-600 focus:ring-blue-700'
                : 'bg-amber-300 text-amber-900 border-amber-500 focus:ring-amber-600'
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
                ? 'bg-white text-blue-600 hover:bg-blue-50'
                : 'bg-amber-300 text-amber-900 hover:bg-amber-200 border border-amber-500'
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
                ? 'text-white bg-blue-600 hover:bg-blue-700 border-blue-700'
                : 'text-amber-900 bg-amber-300 hover:bg-amber-200 border-amber-500'
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
