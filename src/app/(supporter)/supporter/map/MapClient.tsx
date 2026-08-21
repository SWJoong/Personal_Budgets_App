'use client'

import { useState } from 'react'
import KakaoMap, { type MapPlace } from '@/components/map/KakaoMap'
import { providersForDomain, type AssetMarker } from '@/utils/assetMap'

interface DomainOpt {
  id: string
  label: string
}

/**
 * 지원자 자산 지도 — 제공기관(쓸 수 있는 곳)을 영역으로 필터해 지도+목록으로.
 * 설계: goala_asset_map_ux_W.md §6. 영역 = 지출 이력 파생(assetMap, §8-4 id 조인).
 */
export default function SupporterMapClient({
  apiKey,
  markers,
  domains,
  domainLabelById,
}: {
  apiKey: string
  markers: AssetMarker[]
  domains: DomainOpt[]
  domainLabelById: Record<string, string>
}) {
  const [domainId, setDomainId] = useState<string | null>(null) // null = 전체

  const filtered = domainId ? providersForDomain(markers, domainId) : markers
  const places: MapPlace[] = filtered.map((m) => ({
    id: m.id,
    name: m.name,
    lat: m.lat,
    lng: m.lng,
    kind: 'asset',
    category: m.category,
    domainIds: m.domainIds,
    usageCount: m.usageCount,
    amount: m.totalAmount,
  }))

  const chip = (active: boolean) =>
    `text-xs font-bold px-3 min-h-[44px] rounded-full whitespace-nowrap flex items-center transition-colors ring-1 ${
      active ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
    }`

  return (
    <div className="flex flex-col gap-4">
      {/* 영역 필터바 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button type="button" onClick={() => setDomainId(null)} className={chip(!domainId)}>
          전체
        </button>
        {domains.map((d) => (
          <button key={d.id} type="button" onClick={() => setDomainId(d.id)} className={chip(domainId === d.id)}>
            {d.label}
          </button>
        ))}
      </div>

      <KakaoMap apiKey={apiKey} transactions={[]} places={places} height="52dvh" />

      {/* 목록 — 지도와 같은 필터 결과 */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-zinc-500 px-1">
          쓸 수 있는 곳 {filtered.length > 0 && <span className="text-zinc-400">({filtered.length})</span>}
        </h2>
        {filtered.length === 0 ? (
          <p className="text-zinc-400 text-sm py-6 text-center bg-zinc-50 rounded-2xl">
            {domainId ? '이 영역에서 쓴 곳이 아직 없어요.' : '등록된 장소가 아직 없어요.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((m) => (
              <li key={m.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-zinc-800 truncate">{m.name}</span>
                  {m.category && <span className="shrink-0 text-xs text-zinc-400">{m.category}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.domainIds.map((id) => (
                    <span key={id} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200">
                      {domainLabelById[id] ?? '기타'}
                    </span>
                  ))}
                  {m.usageCount > 0 ? (
                    <span className="text-xs text-zinc-500">
                      이용 {m.usageCount}회 · {Math.round(m.totalAmount).toLocaleString('ko-KR')}원
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">아직 쓴 기록 없음</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
