'use client'

import { useState, useRef, useEffect } from 'react'
import { searchPlaces } from '@/app/actions/geocode'
import type { PlaceResult } from '@/app/actions/geocode'

interface PlaceSearchProps {
  onSelect: (place: PlaceResult) => void
  onClear: () => void
  selectedPlace: PlaceResult | null
  defaultQuery?: string
}

export default function PlaceSearch({
  onSelect,
  onClear,
  selectedPlace,
  defaultQuery = '',
}: PlaceSearchProps) {
  const [query, setQuery] = useState(defaultQuery)
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setOpen(true)
    setResults([])

    try {
      const data = await searchPlaces(query)
      setResults(data)
    } catch (e) {
      console.error('Place search failed:', e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  if (selectedPlace) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 ring-1 ring-blue-200">
        <span className="text-base">📍</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-900 truncate">{selectedPlace.place_name}</p>
          <p className="text-xs text-blue-500 truncate">{selectedPlace.road_address_name || selectedPlace.address_name}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-bold text-blue-400 hover:text-blue-600 shrink-0 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
        >
          변경
        </button>
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="relative flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="장소명 검색 (예: 교보문고 광화문점)"
          className="flex-1 p-3 rounded-xl bg-zinc-50 ring-1 ring-zinc-200 text-zinc-800 text-sm focus:ring-zinc-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-3 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-700 transition-all disabled:bg-zinc-300"
        >
          {loading ? '...' : '검색'}
        </button>
      </div>

      {open && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-xl shadow-xl ring-1 ring-zinc-200 z-50 overflow-hidden max-h-60 overflow-y-auto">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-zinc-400 text-center">
              {loading ? '검색 중...' : '검색 결과가 없습니다.'}
            </p>
          ) : (
            results.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  onSelect(place)
                  setOpen(false)
                  setQuery(place.place_name)
                }}
                className="w-full flex flex-col px-4 py-3 text-left hover:bg-zinc-50 border-b border-zinc-100 last:border-0 transition-colors"
              >
                <span className="text-sm font-bold text-zinc-900">{place.place_name}</span>
                <span className="text-xs text-zinc-400 mt-0.5">
                  {place.road_address_name || place.address_name}
                </span>
                {place.category_name && (
                  <span className="text-[10px] text-zinc-300 mt-0.5">{place.category_name}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
