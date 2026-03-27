'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Participant {
  id: string
  name: string
}

interface PreviewBannerProps {
  currentParticipant: Participant
  allParticipants: Participant[]
}

export default function PreviewBanner({ currentParticipant, allParticipants }: PreviewBannerProps) {
  const router = useRouter()

  return (
    <div className="sticky top-0 z-50 bg-amber-400 text-amber-900 shadow-md">
      <div className="flex items-center justify-between px-4 py-2.5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <span className="text-base">👁</span>
          <span className="text-sm font-black">미리보기 모드</span>
          <span className="text-amber-700 text-sm">·</span>
          <select
            value={currentParticipant.id}
            onChange={(e) => router.push(`/admin/participants/${e.target.value}/preview`)}
            className="text-sm font-bold bg-amber-300 text-amber-900 border border-amber-500 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            {allParticipants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-medium text-amber-700 bg-amber-300 px-2 py-1 rounded-lg">
            읽기 전용
          </span>
          <Link
            href={`/admin/participants/${currentParticipant.id}`}
            className="flex items-center gap-1 text-sm font-bold text-amber-900 bg-amber-300 hover:bg-amber-200 border border-amber-500 px-3 py-1 rounded-lg transition-colors"
          >
            <span>✕</span>
            <span>닫기</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
