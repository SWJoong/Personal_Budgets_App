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

/**
 * 영역(domain_id)으로 자산 필터 — 그 영역에서 쓰인 장소만(§8-4 id 조인, 라벨 아님).
 * ★ 제네릭: '내가 쓴 곳'(AssetMarker)·'쓸 수 있는 곳'(DiscoveryMarker) 마커에 공용(§4).
 *   domainIds 만 요구하므로 두 마커 타입 모두 만족(후방호환).
 */
export function providersForDomain<T extends { domainIds: string[] }>(markers: T[], domainId: string): T[] {
  return markers.filter((m) => m.domainIds.includes(domainId))
}

// =====================================================================
// "쓸 수 있는 곳"(발견) — 전역 제공기관×영역 집계 소스
//
//   설계: goala_provider_domains_W.md · 골든: assetMapDiscovery.test.ts
//   소스: seoul_provider_domains() RPC(SECURITY DEFINER, PII 없음 — 11_provider_domains.sql).
//
//   '내가 쓴 곳'(buildProviderAssets)이 본인 지출(RLS 스코프·금액 있음)에서 파생한다면,
//   '쓸 수 있는 곳'은 전 참여자 지출을 신원제거·집계한 전역 소스에서 파생한다(금액 개념 없음).
//   둘 다 같은 domain_id 로 예산 영역 필터와 이어진다(예산→자산→지출 한 축, §1).
// =====================================================================

/** seoul_provider_domains() RPC 한 행. PII 없음(신원·금액·날짜 없음, 집계 수치만). */
export interface ProviderDomainRow {
  provider_id: string
  provider_name: string
  category: string | null
  lat: number | null
  lng: number | null
  domain_id: string
  domain_code: string
  domain_label: string
  program: string
  usage_count: number
}

/** 발견(쓸 수 있는 곳) 마커 — 금액 없음(전역·신원제거 소스라 '본인 금액'이라는 개념이 없다). */
export interface DiscoveryMarker {
  id: string
  name: string
  lat: number
  lng: number
  category: string | null
  domainIds: string[] // §8-4 id 기준, 유니크·정렬
  usageCount: number // 이 장소의 전 영역 이용 합(전역)
}

/**
 * 전역 제공기관×영역 행(RPC)을 발견 마커로 접는다 — 제공기관 단위, domainIds[].
 *  - 한 제공기관의 여러 (provider,domain) 행 → 한 마커. domainIds = 그 영역 id 집합(유니크·정렬),
 *    usageCount = 그 제공기관의 usage_count 합(전 영역·전역).
 *  - 좌표(lat·lng) 둘 다 있어야 마커(하나라도 null → 지도에 못 찍음, 제외).
 *  - domainIds 는 라벨이 아니라 domain_id(§8-4, program 스코프 라벨 충돌 방지).
 *  - 마커·domainIds 모두 결정적으로 정렬(UI 결정성 — RPC 행 순서에 의존하지 않는다).
 */
export function buildDiscoveryAssets(rows: ProviderDomainRow[]): DiscoveryMarker[] {
  const markers = new Map<string, DiscoveryMarker>()
  const domainsByProvider = new Map<string, Set<string>>()

  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue // 좌표 불완전 → 지도에 못 찍음
    let marker = markers.get(r.provider_id)
    if (!marker) {
      marker = {
        id: r.provider_id,
        name: r.provider_name,
        lat: r.lat,
        lng: r.lng,
        category: r.category,
        domainIds: [],
        usageCount: 0,
      }
      markers.set(r.provider_id, marker)
      domainsByProvider.set(r.provider_id, new Set<string>())
    }
    marker.usageCount += Number(r.usage_count ?? 0) // 전 영역 합(전역)
    domainsByProvider.get(r.provider_id)!.add(r.domain_id) // §8-4 id 기준
  }

  for (const [providerId, set] of domainsByProvider) {
    markers.get(providerId)!.domainIds = [...set].sort() // 유니크·정렬(UI 결정성)
  }

  // 마커도 id 로 정렬 — RPC 행 순서와 무관하게 결정적.
  return [...markers.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
