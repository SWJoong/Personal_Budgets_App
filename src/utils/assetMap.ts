/**
 * 자산 맵핑(제공기관 지도) 집계 — 순수 로직. 서버/클라이언트 공용, 테스트 가능.
 * 설계: Plan&Source/goala_asset_map_ux_W.md §4. 골든: assetMap.test.ts.
 *
 * GOAL축 A 지도의 핵심: 당사자가 예산을 쓸 수 있는 실제 장소(제공기관)를 지도에 올린다(자원지도).
 * 예산(영역/domain) → 자산 지도(어디서 쓸 수 있나) → 지출(어디서 썼나)을 같은 domain_id 로 잇는다.
 *
 * 두 가지 설계 불변식:
 *  - 제공기관의 "영역"은 스키마 FK 가 아니라 **지출 이력에서 파생**한다(providers 에 domain_id 없음).
 *    한 장소는 여러 영역에 쓰일 수 있어(카페=문화+일상) 단일 FK 는 손실적(§8-5 정신). 그래서 영역 태그는
 *    그 장소에서 실제 일어난 지출의 domain_id 집합으로 모은다(emergent asset map).
 *  - 조인은 domain_id(§8-4 id 기준, 라벨 금지) — program(seoul·mohw) 스코프 라벨 충돌 방지.
 */

/** seoul_service_providers 최소 행. */
export interface ProviderRow {
  id: string
  name: string
  lat: number | null
  lng: number | null
  category: string | null
}

/** seoul_service_usages 최소 행(장소·영역·금액). */
export interface UsageRow {
  provider_id: string | null
  domain_id: string | null
  amount: number | null
}

export interface AssetMarker {
  id: string
  name: string
  lat: number
  lng: number
  category: string | null
  domainIds: string[] // 지출 이력 파생, 유니크·정렬(§8-4 id)
  usageCount: number // 이 장소 지출 건수
  totalAmount: number // 이 장소 지출 합
}

/**
 * 제공기관 + 지출이력 → 지도 마커. 좌표(lat·lng) 둘 다 있는 제공기관만 마커가 되고,
 * 영역 태그·건수·금액은 그 장소 지출에서 파생한다. 지출 없던 제공기관도 자산 디렉터리로 남는다.
 * 마커에 없는(좌표없는·미존재·null) provider 의 지출은 무시한다.
 */
export function buildProviderAssets(providers: ProviderRow[], usages: UsageRow[]): AssetMarker[] {
  const markers = new Map<string, AssetMarker>()
  for (const p of providers) {
    if (p.lat == null || p.lng == null) continue // 좌표 불완전 → 지도에 못 찍음
    markers.set(p.id, {
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
      domainIds: [],
      usageCount: 0,
      totalAmount: 0,
    })
  }

  const domainsByProvider = new Map<string, Set<string>>()
  for (const u of usages) {
    if (u.provider_id == null) continue
    const marker = markers.get(u.provider_id)
    if (!marker) continue // 좌표없음/미존재 → 무시
    marker.usageCount += 1
    marker.totalAmount += Number(u.amount ?? 0) // null 금액 → 0
    if (u.domain_id != null) {
      let set = domainsByProvider.get(u.provider_id)
      if (!set) {
        set = new Set<string>()
        domainsByProvider.set(u.provider_id, set)
      }
      set.add(u.domain_id) // null domain 은 태그 제외(건수엔 포함)
    }
  }

  for (const [providerId, set] of domainsByProvider) {
    const marker = markers.get(providerId)
    if (marker) marker.domainIds = [...set].sort() // 안정 정렬(UI 결정성)
  }

  return [...markers.values()]
}

/** 영역(domain_id)으로 자산 필터 — 그 영역에서 쓰인 장소만(§8-4 id 조인, 라벨 아님). */
export function providersForDomain(markers: AssetMarker[], domainId: string): AssetMarker[] {
  return markers.filter((m) => m.domainIds.includes(domainId))
}
