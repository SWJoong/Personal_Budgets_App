import { describe, it, expect } from 'vitest'
import {
  buildProviderAssets,
  providersForDomain,
  type ProviderRow,
  type UsageRow,
} from './assetMap'

/**
 * 자산 맵핑(제공기관 지도) 집계 골든 — GOAL축 A 지도.
 * 설계: Plan&Source/goala_asset_map_ux_W.md. 순수함수라 DB·지도 SDK 없이 로직을 못박는다.
 *
 * ★ 이 골든은 test-first(W)로 RED 다 — src/utils/assetMap.ts 가 아직 없다. U 가 구현하면 green.
 *
 * 핵심 불변식:
 *  (1) 좌표(lat·lng) 둘 다 있는 제공기관만 지도 마커가 된다(하나라도 null 이면 못 찍음).
 *  (2) 제공기관의 "영역"은 스키마 FK 가 아니라 지출 이력에서 파생한다(providers 에 domain_id 없음).
 *      영역 태그는 그 장소에서 일어난 지출의 domain_id(§8-4 id 기준, 라벨 아님)로 모은다.
 *  (3) 지출이 없던 제공기관도 "쓸 수 있는 곳"으로 지도에 남는다(자산 디렉터리) — usageCount 0.
 */

const providers: ProviderRow[] = [
  { id: 'p-cafe', name: '햇살카페', lat: 37.56, lng: 126.97, category: '카페' },
  { id: 'p-gym', name: '나눔체육관', lat: 37.57, lng: 126.98, category: '체육' },
  { id: 'p-noloc', name: '좌표없는곳', lat: null, lng: 126.99, category: '기타' }, // 좌표 불완전 → 제외
  { id: 'p-new', name: '새로생긴가게', lat: 37.55, lng: 126.96, category: '상점' }, // 지출 이력 없음
]

describe('buildProviderAssets — 제공기관을 지도 마커로 집계', () => {
  it('좌표가 둘 다 있는 제공기관만 마커가 된다', () => {
    const markers = buildProviderAssets(providers, [])
    expect(markers.map((m) => m.id).sort()).toEqual(['p-cafe', 'p-gym', 'p-new'])
    expect(markers.find((m) => m.id === 'p-noloc')).toBeUndefined() // lat null → 제외
  })

  it('지출 이력에서 영역 태그·건수·금액을 파생한다(§8-4 domain_id 기준)', () => {
    const usages: UsageRow[] = [
      { provider_id: 'p-cafe', domain_id: 'd-culture', amount: 12000 },
      { provider_id: 'p-cafe', domain_id: 'd-culture', amount: 8000 }, // 같은 영역 2건
      { provider_id: 'p-cafe', domain_id: 'd-daily', amount: 5000 }, //  다른 영역
      { provider_id: 'p-gym', domain_id: 'd-health', amount: 30000 },
    ]
    const markers = buildProviderAssets(providers, usages)
    const cafe = markers.find((m) => m.id === 'p-cafe')!
    expect(cafe.usageCount).toBe(3)
    expect(cafe.totalAmount).toBe(25000) // 12000+8000+5000
    expect([...cafe.domainIds].sort()).toEqual(['d-culture', 'd-daily']) // 유니크, 라벨 아닌 id
    const gym = markers.find((m) => m.id === 'p-gym')!
    expect(gym.domainIds).toEqual(['d-health'])
  })

  it('지출이 없던 제공기관도 남는다(자산 디렉터리) — usageCount 0·domainIds 빈 배열', () => {
    const markers = buildProviderAssets(providers, [])
    const nw = markers.find((m) => m.id === 'p-new')!
    expect(nw.usageCount).toBe(0)
    expect(nw.totalAmount).toBe(0)
    expect(nw.domainIds).toEqual([])
  })

  it('null amount 는 0, null domain_id 는 영역 태그에서 제외(건수엔 포함)', () => {
    const usages: UsageRow[] = [
      { provider_id: 'p-cafe', domain_id: null, amount: null }, // 미분류·금액없음
      { provider_id: 'p-cafe', domain_id: 'd-daily', amount: 3000 },
    ]
    const cafe = buildProviderAssets(providers, usages).find((m) => m.id === 'p-cafe')!
    expect(cafe.usageCount).toBe(2) // 두 건 모두 집계
    expect(cafe.totalAmount).toBe(3000) // null → 0
    expect(cafe.domainIds).toEqual(['d-daily']) // null domain 은 태그 제외
  })

  it('마커에 없는(좌표없는·미존재) 제공기관의 지출은 무시된다', () => {
    const usages: UsageRow[] = [
      { provider_id: 'p-noloc', domain_id: 'd-daily', amount: 9999 }, // 좌표없어 마커 아님
      { provider_id: 'p-ghost', domain_id: 'd-daily', amount: 5000 }, // providers 에 없음
      { provider_id: null, domain_id: 'd-daily', amount: 1000 }, //       provider 없음
    ]
    const markers = buildProviderAssets(providers, usages)
    expect(markers.reduce((s, m) => s + m.totalAmount, 0)).toBe(0) // 어떤 마커에도 안 붙음
  })

  it('domainIds 는 안정적으로 정렬된다(UI 결정성)', () => {
    const usages: UsageRow[] = [
      { provider_id: 'p-cafe', domain_id: 'd-z', amount: 1 },
      { provider_id: 'p-cafe', domain_id: 'd-a', amount: 1 },
      { provider_id: 'p-cafe', domain_id: 'd-m', amount: 1 },
    ]
    const cafe = buildProviderAssets(providers, usages).find((m) => m.id === 'p-cafe')!
    expect(cafe.domainIds).toEqual(['d-a', 'd-m', 'd-z'])
  })
})

describe('providersForDomain — 영역으로 자산 필터(§8-4 id 조인)', () => {
  const usages: UsageRow[] = [
    { provider_id: 'p-cafe', domain_id: 'd-culture', amount: 10000 },
    { provider_id: 'p-gym', domain_id: 'd-health', amount: 20000 },
  ]

  it('해당 영역에서 쓰인 장소만 돌려준다', () => {
    const markers = buildProviderAssets(providers, usages)
    const culture = providersForDomain(markers, 'd-culture')
    expect(culture.map((m) => m.id)).toEqual(['p-cafe'])
  })

  it('라벨이 아니라 domain_id 로 매칭한다(동명 영역 오염 방지)', () => {
    const markers = buildProviderAssets(providers, usages)
    // 'd-health' 로 조회하면 체육관만 — 카페(문화)나 미사용 장소는 안 섞인다.
    expect(providersForDomain(markers, 'd-health').map((m) => m.id)).toEqual(['p-gym'])
    expect(providersForDomain(markers, 'd-없는영역')).toEqual([])
  })
})
