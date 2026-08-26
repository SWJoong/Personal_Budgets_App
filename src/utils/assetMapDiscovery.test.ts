import { describe, it, expect } from 'vitest'
import {
  buildDiscoveryAssets,
  providersForDomain,
  type ProviderDomainRow,
} from './assetMap'

/**
 * 자산지도 "쓸 수 있는 곳"(발견) 집계 골든 — GOAL축 A 지도, 전역 소스.
 * 설계: Plan&Source/goala_provider_domains_W.md §4. 순수함수라 DB·지도 SDK 없이 못박는다.
 *
 * ★ test-first(W)로 RED — src/utils/assetMap.ts 에 buildDiscoveryAssets 가 아직 없다.
 *   (providersForDomain 도 제네릭화 필요 — 발견 마커에 재사용.) U 가 구현하면 green.
 *
 * 입력 = seoul_provider_domains() RPC 한 행(제공기관×영역 전역 집계, PII 없음).
 * 핵심 불변식:
 *  (1) 한 제공기관의 여러 (provider,domain) 행 → 한 마커로 접힌다. domainIds 유니크·정렬,
 *      usageCount = 그 제공기관의 usage_count 합(전역).
 *  (2) 좌표(lat·lng) 둘 다 있어야 마커(하나라도 null → 지도에 못 찍음, 제외).
 *  (3) domainIds 는 라벨 아니라 domain_id(§8-4, program 스코프 라벨 충돌 방지).
 *  (4) providersForDomain 은 발견 마커에도 동작(제네릭).
 */

const rows: ProviderDomainRow[] = [
  // 나눔카페 — 두 영역에 쓰임(사회생활 5건 + 일상생활 2건)
  { provider_id: 'pv-cafe', provider_name: '나눔카페', category: '카페', lat: 37.56, lng: 126.97,
    domain_id: 'd-social', domain_code: 'social_life', domain_label: '사회생활', program: 'seoul', usage_count: 5 },
  { provider_id: 'pv-cafe', provider_name: '나눔카페', category: '카페', lat: 37.56, lng: 126.97,
    domain_id: 'd-daily', domain_code: 'daily_living', domain_label: '일상생활', program: 'seoul', usage_count: 2 },
  // 햇살체육관 — 건강·안전 3건
  { provider_id: 'pv-gym', provider_name: '햇살체육관', category: '체육', lat: 37.57, lng: 126.98,
    domain_id: 'd-health', domain_code: 'health_safety', domain_label: '건강·안전', program: 'seoul', usage_count: 3 },
  // 좌표 없는 곳 — lat null → 지도에 못 찍음, 제외돼야 한다
  { provider_id: 'pv-noloc', provider_name: '좌표없는곳', category: null, lat: null, lng: 126.9,
    domain_id: 'd-daily', domain_code: 'daily_living', domain_label: '일상생활', program: 'seoul', usage_count: 9 },
]

describe('buildDiscoveryAssets — 전역 제공기관→영역 행을 발견 마커로 접기', () => {
  it('한 제공기관의 여러 영역 행을 한 마커로 접고 usageCount 를 합산한다', () => {
    const markers = buildDiscoveryAssets(rows)
    const cafe = markers.find((m) => m.id === 'pv-cafe')!
    expect(cafe.name).toBe('나눔카페')
    expect([...cafe.domainIds].sort()).toEqual(['d-daily', 'd-social']) // 유니크·정렬, id 기준
    expect(cafe.usageCount).toBe(7) // 5 + 2 (전 영역 합)
    const gym = markers.find((m) => m.id === 'pv-gym')!
    expect(gym.domainIds).toEqual(['d-health'])
    expect(gym.usageCount).toBe(3)
  })

  it('좌표(lat·lng)가 둘 다 있는 제공기관만 마커가 된다', () => {
    const markers = buildDiscoveryAssets(rows)
    expect(markers.map((m) => m.id).sort()).toEqual(['pv-cafe', 'pv-gym'])
    expect(markers.find((m) => m.id === 'pv-noloc')).toBeUndefined() // lat null → 제외
  })

  it('domainIds 는 라벨이 아니라 domain_id 로 모은다(§8-4 id, 동명 영역 오염 방지)', () => {
    const markers = buildDiscoveryAssets(rows)
    const cafe = markers.find((m) => m.id === 'pv-cafe')!
    expect(cafe.domainIds).not.toContain('사회생활') // 라벨 아님
    expect(cafe.domainIds).toContain('d-social') // id
  })

  it('빈 입력 → 빈 배열', () => {
    expect(buildDiscoveryAssets([])).toEqual([])
  })

  it('마커·domainIds 모두 결정적으로 정렬된다(UI 결정성)', () => {
    const a = buildDiscoveryAssets(rows)
    const b = buildDiscoveryAssets([...rows].reverse())
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id))
    expect(a.find((m) => m.id === 'pv-cafe')!.domainIds)
      .toEqual(b.find((m) => m.id === 'pv-cafe')!.domainIds)
  })
})

describe('providersForDomain — 발견 마커에도 재사용(제네릭, §8-4 id 필터)', () => {
  it('해당 영역에서 쓰인 장소만 돌려준다', () => {
    const markers = buildDiscoveryAssets(rows)
    expect(providersForDomain(markers, 'd-social').map((m) => m.id)).toEqual(['pv-cafe'])
    expect(providersForDomain(markers, 'd-health').map((m) => m.id)).toEqual(['pv-gym'])
    expect(providersForDomain(markers, 'd-없는영역')).toEqual([])
  })
})
