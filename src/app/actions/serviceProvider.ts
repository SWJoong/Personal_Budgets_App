'use server'

import { createClient } from '@/utils/supabase/server'
import { friendlyDbError } from '@/utils/supabase/errors'
import { buildDiscoveryAssets, type ProviderRow, type ProviderDomainRow, type DiscoveryMarker } from '@/utils/assetMap'

export interface ProviderInput {
  name: string
  address?: string
  lat?: number
  lng?: number
}

/**
 * 제공기관(이용 장소) 전량 읽기 — 자산 지도용. 좌표 유무 무관 전량 반환(필터는 화면/순수로직 assetMap).
 * RLS(04): seoul_service_providers 읽기는 로그인 전원 허용이라 새 정책 불필요.
 */
export async function getProviders(): Promise<{ providers: ProviderRow[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { providers: [], error: '로그인이 필요합니다.' }

  const { data, error } = await supabase
    .from('seoul_service_providers')
    .select('id, name, lat, lng, category')
    .order('name', { ascending: true })

  if (error) return { providers: [], error: error.message }
  return { providers: (data ?? []) as ProviderRow[] }
}

/**
 * 자산지도 "쓸 수 있는 곳"(발견) — 전역 제공기관×영역 집계.
 * seoul_provider_domains() RPC(SECURITY DEFINER, PII 없음)를 호출해 마커로 접는다(assetMap, §4).
 * '내가 쓴 곳'(getProviders→buildProviderAssets, RLS 스코프)과 달리 전 참여자 지출을 신원제거·합산한다.
 *
 * ★ 함수는 대시보드 수동 반영(Manual-Ops Gate) 대상이라 아직 없을 수 있다 — 이때는 빈 결과 + 안내로
 *   폴백해 화면이 깨지지 않게 한다(지도는 '내가 쓴 곳' 탭으로 계속 동작).
 */
export async function getDiscoveryAssets(): Promise<{
  markers: DiscoveryMarker[]
  domains: { id: string; label: string }[]
  domainLabelById: Record<string, string>
  error?: string
}> {
  const empty = { markers: [] as DiscoveryMarker[], domains: [] as { id: string; label: string }[], domainLabelById: {} as Record<string, string> }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ...empty, error: '로그인이 필요합니다.' }

  const { data, error } = await supabase.rpc('seoul_provider_domains')
  if (error) return { ...empty, error: error.message }

  const rows = (data ?? []) as ProviderDomainRow[]
  const markers = buildDiscoveryAssets(rows)

  // 영역 필터용 라벨 맵·목록 — RPC 행에서 파생(§8-4 id → 라벨). 정렬로 UI 결정성.
  const labelById: Record<string, string> = {}
  for (const r of rows) labelById[r.domain_id] = r.domain_label
  const domains = Object.entries(labelById)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'))

  return { markers, domains, domainLabelById: labelById }
}

/**
 * 이용 장소 등록 — 참여자·실무자가 지출을 기록하며 그 자리에서 만든다.
 * (04_seoul_rls.sql: seoul_service_providers 는 관리자 전용 참조표가 아니라
 * 실사용 중 자라나는 장소 디렉터리라 INSERT 는 로그인만 하면 열려 있다.)
 *
 * 같은 주소가 이미 있으면 새로 만들지 않고 그 장소를 재사용한다 — 안 그러면
 * 같은 카페를 갈 때마다 지도에 마커가 겹쳐 늘어난다.
 */
export async function findOrCreateProvider(input: ProviderInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (input.address) {
    const { data: existing } = await supabase
      .from('seoul_service_providers')
      .select('id')
      .eq('address', input.address)
      .maybeSingle()
    if (existing) return { success: true, providerId: existing.id as string }
  }

  const { data, error } = await supabase
    .from('seoul_service_providers')
    .insert({
      name: input.name,
      address: input.address || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { error: `장소 등록 실패: ${friendlyDbError(error)}` }
  return { success: true, providerId: data.id as string }
}
