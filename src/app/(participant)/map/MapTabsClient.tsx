'use client'

import { useState } from 'react'
import KakaoMap, { type MapTransaction, type MapPlace } from '@/components/map/KakaoMap'
import { providersForDomain, type DiscoveryMarker } from '@/utils/assetMap'
import { EmptyState } from '@/components/ui/EmptyState'

type Tab = 'mine' | 'discover'

/**
 * 당사자 지도 — 두 소스를 탭으로 오간다(설계 goala_provider_domains_W.md §4).
 *  · 내가 쓴 곳 = 본인 지출 이력(RLS 스코프, 금액 있음)  · 쓸 수 있는 곳 = 전역 발견(신원제거, 금액 없음)
 * 둘 다 같은 domain_id 로 예산 영역과 이어진다(예산→자산→지출 한 축).
 */
export default function MapTabsClient({
  apiKey,
  transactions,
  discoveryMarkers,
  domains,
  domainLabelById,
  discoveryError,
}: {
  apiKey: string
  transactions: MapTransaction[]
  discoveryMarkers: DiscoveryMarker[]
  domains: { id: string; label: string }[]
  domainLabelById: Record<string, string>
  discoveryError?: string
}) {
  const [tab, setTab] = useState<Tab>('mine')
  const [domainId, setDomainId] = useState<string | null>(null) // null = 전체

  const filtered = domainId ? providersForDomain(discoveryMarkers, domainId) : discoveryMarkers
  const places: MapPlace[] = filtered.map((m) => ({
    id: m.id,
    name: m.name,
    lat: m.lat,
    lng: m.lng,
    kind: 'asset',
    category: m.category,
    domainIds: m.domainIds,
    usageCount: m.usageCount,
    // amount 없음 — 전역·신원제거 소스라 '본인 금액' 개념이 없다.
  }))

  const tabBtn = (active: boolean) =>
    `flex-1 min-h-[48px] rounded-xl text-sm font-black transition-colors ${
      active ? 'bg-hero text-hero-foreground' : 'bg-card text-muted-foreground ring-1 ring-border hover:bg-muted-hover hover:text-foreground'
    }`
  const chip = (active: boolean) =>
    `text-xs font-bold px-3 min-h-[44px] rounded-full whitespace-nowrap flex items-center transition-colors ring-1 ${
      active ? 'bg-asset text-asset-foreground ring-asset' : 'bg-card text-muted-foreground ring-border hover:bg-muted-hover hover:text-foreground'
    }`

  return (
    <div className="flex flex-col gap-4">
      {/* 탭 토글 */}
      <div className="flex gap-2" role="tablist" aria-label="지도 보기 방식">
        <button type="button" role="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')} className={tabBtn(tab === 'mine')}>
          🧾 내가 쓴 곳
        </button>
        <button type="button" role="tab" aria-selected={tab === 'discover'} onClick={() => setTab('discover')} className={tabBtn(tab === 'discover')}>
          📍 쓸 수 있는 곳
        </button>
      </div>

      {tab === 'mine' ? (
        <KakaoMap apiKey={apiKey} transactions={transactions} height="58dvh" />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground leading-relaxed px-1">
            다른 사람들이 예산으로 다녀온 곳이에요.<br />여기서 나도 돈을 쓸 수 있어요.
          </p>

          {/* 영역 필터 */}
          {domains.length > 0 && (
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
          )}

          <KakaoMap apiKey={apiKey} transactions={[]} places={places} height="52dvh" />

          {/* 목록 — 지도와 같은 필터 결과(지도만으로는 읽기 어려운 이용자 배려) */}
          {discoveryError ? (
            <p className="text-muted-foreground text-sm py-6 text-center bg-muted rounded-2xl leading-relaxed">
              쓸 수 있는 곳 정보는<br />곧 준비될 예정이에요.
            </p>
          ) : filtered.length === 0 ? (
            <EmptyState title={domainId ? '이 영역에서 쓸 수 있는 곳이 아직 없어요.' : '쓸 수 있는 곳이 아직 없어요.'} />
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((m) => (
                <li key={m.id} className="p-4 rounded-2xl bg-card ring-1 ring-border flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground truncate">{m.name}</span>
                    {m.category && <span className="shrink-0 text-xs text-muted-foreground">{m.category}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.domainIds.map((id) => (
                      <span key={id} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-asset-bg text-asset-fg ring-1 ring-asset-fg/20">
                        {domainLabelById[id] ?? '기타'}
                      </span>
                    ))}
                    <span className="text-xs text-muted-foreground">여러 사람이 {m.usageCount}번 이용</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
