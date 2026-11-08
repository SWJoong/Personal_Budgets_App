'use client'

import PlaceSearch from '@/components/map/PlaceSearch'
import type { PlaceResult } from '@/app/actions/geocode'
import type { ReceiptPlaceSource, ReceiptPlaceStatus } from '@/components/map/useReceiptPlace'

interface ReceiptPlaceBoxProps {
  status: ReceiptPlaceStatus
  place: PlaceResult | null
  source: ReceiptPlaceSource
  /** 직접 검색 칸에 미리 넣어 줄 상호 */
  hintName: string
  onChoose: (place: PlaceResult) => void
  onClear: () => void
}

/**
 * 영수증에서 찾은 장소를 보여 주는 칸 (영수증 입력 화면 · 홈 화면 창 공용).
 * 찾는 중 → 찾았어요(지우기) / 못 찾았어요(직접 검색) 순서로 바뀐다.
 */
export default function ReceiptPlaceBox({
  status,
  place,
  source,
  hintName,
  onChoose,
  onClear,
}: ReceiptPlaceBoxProps) {
  if (status === 'idle') return null

  if (status === 'searching') {
    return (
      <div
        role="status"
        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-50 ring-1 ring-blue-100 text-sm font-bold text-blue-700"
      >
        <span aria-hidden="true">📍</span>
        장소를 찾고 있어요...
      </div>
    )
  }

  if (place) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-50 ring-1 ring-blue-200">
        <span className="text-base shrink-0" aria-hidden="true">📍</span>
        <div role="status" className="flex-1 min-w-0">
          <p className="text-xs font-black text-blue-700">
            {source === 'auto' ? '장소 자동 감지' : '선택한 장소'}
          </p>
          <p className="text-sm font-bold text-blue-900 truncate">{place.place_name}</p>
          <p className="text-xs text-blue-500 truncate">
            {place.road_address_name || place.address_name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-blue-500 hover:text-blue-700 font-bold shrink-0 min-h-[44px] min-w-[44px] px-2 rounded-lg hover:bg-blue-100 transition-colors"
        >
          지우기
        </button>
      </div>
    )
  }

  // notFound · cleared: 직접 검색할 수 있게 검색 칸을 보여 준다
  return (
    <div className="flex flex-col gap-2">
      {status === 'notFound' ? (
        <div
          role="status"
          className="px-4 py-3 rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 text-sm font-bold text-zinc-700"
        >
          📍 장소를 못 찾았어요. 직접 검색해 주세요.
        </div>
      ) : (
        <p className="text-xs font-bold text-zinc-500 ml-1">📍 장소 직접 찾기 (선택)</p>
      )}
      <PlaceSearch
        selectedPlace={null}
        defaultQuery={hintName}
        onSelect={onChoose}
        onClear={onClear}
      />
    </div>
  )
}
