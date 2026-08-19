'use server'

import { createClient } from '@/utils/supabase/server'
import { friendlyDbError } from '@/utils/supabase/errors'

export interface ProviderInput {
  name: string
  address?: string
  lat?: number
  lng?: number
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
