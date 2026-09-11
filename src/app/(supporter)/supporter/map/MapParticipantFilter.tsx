'use client'

import { useId } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 지도 당사자별 필터 — 담당 당사자를 골라 그 사람이 '쓴 곳'만 보기(?participant=id).
 * '전체' 선택 시 파라미터 없이 전체 자산지도로 이동한다. 실제 스코프(scopeMarkersToUsed)는
 * page.tsx 가 담당하고, 이 컨트롤은 URL 파라미터만 설정한다(08 §8 ④).
 */
export default function MapParticipantFilter({
  participants,
  selected,
}: {
  participants: { id: string; name: string | null }[]
  selected?: string
}) {
  const router = useRouter()
  const selectId = useId()

  function handleChange(value: string) {
    router.push(value ? `/supporter/map?participant=${value}` : '/supporter/map')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-bold text-muted-foreground px-1">
        당사자별로 보기
      </label>
      <select
        id={selectId}
        value={selected ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-[44px] px-3 rounded-lg bg-card ring-1 ring-border text-foreground text-sm"
      >
        <option value="">전체</option>
        {participants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name ?? '이름 없음'}
          </option>
        ))}
      </select>
    </div>
  )
}
